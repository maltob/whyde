import {
  RuntimeProvider,
  RunRequest,
  RuntimeEvent,
  RuntimeProbeResult,
  LanguageId,
} from '@ide/execution-contracts';
import { compileAndRunJava } from './compiler.js';

export * from './compiler.js';

export interface JavaWorkerBridge {
  postMessage(msg: any): void;
  terminate(): void;
  onmessage: ((event: { data: any }) => void) | null;
  onerror: ((error: any) => void) | null;
}

export class DirectJavaWorkerBridge implements JavaWorkerBridge {
  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  private terminated = false;
  private pendingStdinCb: ((input: string) => void) | null = null;

  postMessage(msg: any) {
    if (this.terminated) return;
    if (msg.type === 'stdin-response') {
      if (this.pendingStdinCb) {
        const cb = this.pendingStdinCb;
        this.pendingStdinCb = null;
        cb(msg.text);
      }
      return;
    }
    if (msg.type === 'run') {
      try {
        Promise.resolve(
          compileAndRunJava(msg.request.project, {
            stdin: msg.request.stdin,
            requestStdin: async (prompt) => {
              return new Promise<string>((res) => {
                this.pendingStdinCb = res;
                this.onmessage?.({
                  data: {
                    type: 'stdin-request',
                    requestId: 'req-' + Date.now(),
                    prompt,
                  },
                });
              });
            },
            onStdout: (text) => {
              if (!this.terminated) this.onmessage?.({ data: { type: 'stdout', text } });
            },
            onStderr: (text) => {
              if (!this.terminated) this.onmessage?.({ data: { type: 'stderr', text } });
            },
          })
        ).then(
          (result) => {
            if (!this.terminated) {
              this.onmessage?.({
                data: {
                  type: 'complete',
                  exitCode: result.exitCode,
                  durationMs: result.durationMs,
                  reason: result.exitCode === 0 ? 'success' : 'exception',
                },
              });
            }
          },
          (err) => {
            if (!this.terminated) this.onerror?.(err);
          }
        );
      } catch (err: any) {
        if (!this.terminated) this.onerror?.(err);
      }
    }
  }

  terminate() {
    this.terminated = true;
    this.pendingStdinCb = null;
  }
}

export class JavaRuntimeProvider implements RuntimeProvider {
  readonly id = 'java-oss';
  readonly language: LanguageId = 'java';

  private currentWorker: JavaWorkerBridge | null = null;
  private currentRunId: string | null = null;
  private workerFactory: () => JavaWorkerBridge;

  constructor(workerFactory?: () => JavaWorkerBridge) {
    this.workerFactory =
      workerFactory ||
      (() => {
        return new DirectJavaWorkerBridge();
      });
  }

  async probe(): Promise<RuntimeProbeResult> {
    return {
      available: true,
      versions: ['11.0.22', '17.0.10'],
    };
  }

  async prepare(onProgress?: (done: number, total?: number) => void): Promise<void> {
    onProgress?.(1, 1);
  }

  async run(request: RunRequest, onEvent: (event: RuntimeEvent) => void): Promise<void> {
    this.currentRunId = request.runId;
    const worker = this.workerFactory();
    this.currentWorker = worker;

    return new Promise((resolve, reject) => {
      try {
        let totalOutputBytes = 0;
        const maxOutputBytes = request.settings.maxOutputBytes || 1024 * 1024;
        let isStopped = false;

        const timeoutTimer = setTimeout(() => {
          if (isStopped) return;
          isStopped = true;
          this.stop(request.runId).then(() => {
            onEvent({
              type: 'stderr',
              text: '\n[Error: Execution timed out]\n',
            });
            onEvent({
              type: 'complete',
              exitCode: 124,
              durationMs: request.settings.maxRunTimeMs,
              reason: 'timeout',
            });
            resolve();
          });
        }, request.settings.maxRunTimeMs || 10000);

        worker.onmessage = (event) => {
          const msg = event.data;
          if (!msg) return;

          if (msg.type === 'stdout' || msg.type === 'stderr') {
            totalOutputBytes += Buffer.byteLength(msg.text || '', 'utf8');
            if (totalOutputBytes > maxOutputBytes) {
              this.stop(request.runId).then(() => {
                onEvent({
                  type: 'stderr',
                  text: '\n[Error: Output limit exceeded]\n',
                });
                onEvent({
                  type: 'complete',
                  exitCode: 137,
                  durationMs: 0,
                  reason: 'resource-limit',
                });
                clearTimeout(timeoutTimer);
                resolve();
              });
              return;
            }
          }

          if (msg.type === 'complete') {
            clearTimeout(timeoutTimer);
            onEvent(msg);
            this.cleanupWorker();
            resolve();
          } else {
            onEvent(msg);
          }
        };

        worker.onerror = (err) => {
          clearTimeout(timeoutTimer);
          onEvent({
            type: 'complete',
            exitCode: 1,
            durationMs: 0,
            reason: 'worker-crash',
          });
          this.cleanupWorker();
          resolve();
        };

        worker.postMessage({ type: 'run', request });
      } catch (err) {
        onEvent({
          type: 'complete',
          exitCode: 1,
          durationMs: 0,
          reason: 'worker-crash',
        });
        reject(err);
      }
    });
  }

  async supplyInput(runId: string, requestId: string, text: string): Promise<void> {
    if (this.currentRunId !== runId || !this.currentWorker) return;
    this.currentWorker.postMessage({
      type: 'stdin-response',
      requestId,
      text,
    });
  }

  async stop(runId: string): Promise<void> {
    if (this.currentRunId === runId) {
      this.cleanupWorker();
    }
  }

  async dispose(): Promise<void> {
    if (this.currentRunId) {
      await this.stop(this.currentRunId);
    }
  }

  private cleanupWorker() {
    if (this.currentWorker) {
      this.currentWorker.terminate();
      this.currentWorker = null;
    }
    this.currentRunId = null;
  }
}

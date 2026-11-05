import {
  RuntimeProvider,
  RunRequest,
  RuntimeEvent,
  RuntimeProbeResult,
  LanguageId,
} from '@ide/execution-contracts';
import { executePythonInPyodide } from './pyodideRunner.js';

export * from './pyodideRunner.js';

export type WorkerToMainMessage =
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'plot'; dataUrl: string }
  | { type: 'stdin-request'; requestId: string; prompt?: string }
  | {
      type: 'diagnostic';
      file?: string;
      line?: number;
      column?: number;
      severity: 'error' | 'warning' | 'info';
      message: string;
    }
  | {
      type: 'complete';
      exitCode: number | null;
      durationMs: number;
      reason:
        | 'success'
        | 'compile-error'
        | 'exception'
        | 'timeout'
        | 'cancelled'
        | 'resource-limit'
        | 'worker-crash';
    };

export type MainToWorkerMessage =
  | { type: 'run'; request: RunRequest }
  | { type: 'stdin-response'; requestId: string; text: string }
  | { type: 'stop' };

export interface PythonWorkerBridge {
  postMessage(msg: MainToWorkerMessage): void;
  terminate(): void;
  onmessage: ((event: { data: WorkerToMainMessage }) => void) | null;
  onerror: ((error: any) => void) | null;
}

class DirectPyodideWorkerBridge implements PythonWorkerBridge {
  onmessage: ((event: { data: WorkerToMainMessage }) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  private terminated = false;

  postMessage(msg: MainToWorkerMessage) {
    if (this.terminated) return;
    if (msg.type === 'run') {
      executePythonInPyodide(msg.request.project, {
        onStdout: (text) => {
          if (!this.terminated) this.onmessage?.({ data: { type: 'stdout', text } });
        },
        onStderr: (text) => {
          if (!this.terminated) this.onmessage?.({ data: { type: 'stderr', text } });
        },
        onEvent: (event) => {
          if (this.terminated) return;
          if (
            event.type === 'complete' ||
            event.type === 'diagnostic' ||
            event.type === 'stdin-request'
          ) {
            this.onmessage?.({ data: event as WorkerToMainMessage });
          }
        },
      }).catch((err) => {
        if (!this.terminated) this.onerror?.(err);
      });
    }
  }

  terminate() {
    this.terminated = true;
  }
}

export class PythonRuntimeProvider implements RuntimeProvider {
  readonly id = 'python-pyodide';
  readonly language: LanguageId = 'python';

  private currentWorker: PythonWorkerBridge | null = null;
  private currentRunId: string | null = null;
  private workerFactory: () => PythonWorkerBridge;

  constructor(workerFactory?: () => PythonWorkerBridge) {
    this.workerFactory =
      workerFactory ||
      (() => {
        // In browser production, create standard Worker loading pyodide worker bundle
        if (typeof Worker !== 'undefined') {
          return new Worker(new URL('./worker.js', import.meta.url), {
            type: 'module',
          }) as unknown as PythonWorkerBridge;
        }
        // In Node / non-Worker environments, use direct in-process Pyodide execution
        return new DirectPyodideWorkerBridge();
      });
  }

  async probe(): Promise<RuntimeProbeResult> {
    const wasmSupported =
      typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';
    return {
      available: wasmSupported,
      versions: ['3.14.2'],
      reason: wasmSupported ? undefined : 'WebAssembly is required for Pyodide',
    };
  }

  async prepare(onProgress?: (done: number, total?: number) => void): Promise<void> {
    onProgress?.(100, 100);
  }

  async run(request: RunRequest, onEvent: (event: RuntimeEvent) => void): Promise<void> {
    this.currentRunId = request.runId;
    onEvent({ type: 'status', status: 'running' });

    return new Promise<void>((resolve, reject) => {
      try {
        const worker = this.workerFactory();
        this.currentWorker = worker;

        let totalOutputBytes = 0;
        const maxOutputBytes = request.settings.maxOutputBytes;

        const timeoutTimer = setTimeout(() => {
          if (this.currentRunId === request.runId) {
            this.stop(request.runId).then(() => {
              onEvent({
                type: 'complete',
                exitCode: 124,
                durationMs: request.settings.maxRunTimeMs,
                reason: 'timeout',
              });
              resolve();
            });
          }
        }, request.settings.maxRunTimeMs);

        worker.onmessage = (event) => {
          if (this.currentRunId !== request.runId) return;

          const msg = event.data;

          if (msg.type === 'stdout' || msg.type === 'stderr') {
            totalOutputBytes += msg.text.length;
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
    if (this.currentRunId !== runId) return;
    if (this.currentWorker) {
      try {
        this.currentWorker.postMessage({ type: 'stop' });
      } catch {}
      this.currentWorker.terminate();
      this.cleanupWorker();
    }
  }

  async dispose(): Promise<void> {
    if (this.currentWorker) {
      this.currentWorker.terminate();
      this.cleanupWorker();
    }
  }

  private cleanupWorker() {
    this.currentWorker = null;
    this.currentRunId = null;
  }
}

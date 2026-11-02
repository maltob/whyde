import {
  RuntimeProvider,
  RunRequest,
  RuntimeEvent,
  RuntimeProbeResult,
  LanguageId,
} from '@ide/execution-contracts';
import { CppToolchainManifest, DEFAULT_CPP_TOOLCHAIN_MANIFEST } from './manifest.js';

export interface CppWorkerBridge {
  postMessage(msg: any): void;
  terminate(): void;
  onmessage: ((event: { data: any }) => void) | null;
  onerror: ((error: any) => void) | null;
}

export class CppRuntimeProvider implements RuntimeProvider {
  readonly id = 'cpp-yowasp';
  readonly language: LanguageId = 'cpp';

  private manifest: CppToolchainManifest;
  private currentWorker: CppWorkerBridge | null = null;
  private currentRunId: string | null = null;
  private workerFactory: () => CppWorkerBridge;

  constructor(manifest?: CppToolchainManifest, workerFactory?: () => CppWorkerBridge) {
    this.manifest = manifest || DEFAULT_CPP_TOOLCHAIN_MANIFEST;
    this.workerFactory =
      workerFactory ||
      (() => {
        if (typeof Worker !== 'undefined') {
          return new Worker(new URL('./worker.js', import.meta.url), {
            type: 'module',
          }) as unknown as CppWorkerBridge;
        }
        throw new Error('Web Workers not available in this environment');
      });
  }

  getManifest(): CppToolchainManifest {
    return this.manifest;
  }

  async probe(): Promise<RuntimeProbeResult> {
    const wasmSupported =
      typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';
    return {
      available: wasmSupported,
      versions: ['C++17', 'C++20'],
      reason: wasmSupported ? undefined : 'WebAssembly is required for Clang and WASI execution',
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

        worker.onerror = () => {
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

        worker.postMessage({
          type: 'compile-and-run',
          request,
          manifest: this.manifest,
        });
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

export * from './manifest.js';
export * from './compiler.js';

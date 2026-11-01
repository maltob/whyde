export type LanguageId = 'python' | 'java' | 'cpp';

export type RuntimeStatus =
  | 'not-installed'
  | 'loading'
  | 'ready'
  | 'running'
  | 'stopping'
  | 'failed'
  | 'unsupported';

export type ProjectFile = {
  path: string;
  encoding: 'utf-8';
  content: string;
};

export type Project = {
  schemaVersion: 1;
  id: string;
  name: string;
  language: LanguageId;
  entrypoint: string;
  files: ProjectFile[];
  toolchain: {
    runtimeId: string;
    requestedVersion: string;
  };
  assignmentRef?: {
    id: string;
    version: number;
    digest: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type ExecutionSettings = {
  maxRunTimeMs: number;
  maxOutputBytes: number;
  maxFiles: number;
  maxProjectBytes: number;
  requestedMemoryMb?: number;
};

export type RuntimeEvent =
  | { type: 'status'; status: RuntimeStatus }
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
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

export type RunRequest = {
  runId: string;
  project: Project;
  stdin?: string;
  settings: ExecutionSettings;
  mode: 'normal' | 'test';
};

export interface RuntimeProbeResult {
  available: boolean;
  reason?: string;
  versions: string[];
  experimental?: boolean;
}

export interface RuntimeProvider {
  readonly id: string;
  readonly language: LanguageId;
  probe(): Promise<RuntimeProbeResult>;
  prepare(onProgress?: (done: number, total?: number) => void): Promise<void>;
  run(request: RunRequest, onEvent: (event: RuntimeEvent) => void): Promise<void>;
  supplyInput(runId: string, requestId: string, text: string): Promise<void>;
  stop(runId: string): Promise<void>;
  dispose(): Promise<void>;
}

import { Fd, WASI } from '@bjorn3/browser_wasi_shim';
// @ts-ignore
import { commands } from '@yowasp/clang';

interface CustomFdOptions {
  onWrite: (str: string) => void;
}

class StreamFd extends Fd {
  private onWrite: (str: string) => void;
  constructor(options: CustomFdOptions) {
    super();
    this.onWrite = options.onWrite;
  }

  override fd_write(data: Uint8Array): { ret: number; nwritten: number } {
    const text = new TextDecoder().decode(data);
    this.onWrite(text);
    return { ret: 0, nwritten: data.length };
  }
}

class StdinFd extends Fd {
  private buffer: Uint8Array = new Uint8Array(0);
  private offset: number = 0;

  constructor(inputString: string = '') {
    super();
    if (inputString) {
      this.buffer = new TextEncoder().encode(inputString.endsWith('\n') ? inputString : inputString + '\n');
    }
  }

  override fd_read(size: number): { ret: number; data: Uint8Array } {
    if (this.offset >= this.buffer.length) {
      return { ret: 0, data: new Uint8Array(0) };
    }
    const available = this.buffer.length - this.offset;
    const toRead = Math.min(size, available);
    const chunk = this.buffer.slice(this.offset, this.offset + toRead);
    this.offset += toRead;
    return { ret: 0, data: chunk };
  }
}

export interface CompileAndRunOptions {
  files: Record<string, string>;
  standard?: string;
  stdin?: string;
  onStdout: (text: string) => void;
  onStderr: (text: string) => void;
  onInfo?: (text: string) => void;
}

export async function compileAndRunCpp(options: CompileAndRunOptions): Promise<{ exitCode: number }> {
  const { files, standard = 'c++17', stdin = '', onStdout, onStderr, onInfo } = options;

  onInfo?.(`Compiling ${Object.keys(files).length} translation unit(s) with Clang (${standard})...\n`);

  // Collect compilation source files
  const cppFiles = Object.keys(files).filter((f) => f.endsWith('.cpp') || f.endsWith('.cc') || f.endsWith('.c'));
  const clangArgs = [`-std=${standard}`, '-fno-exceptions', '-O2', ...cppFiles, '-o', 'out.wasm'];

  let compileStderr = '';
  let compileStdout = '';

  let compileResultFiles: any;
  try {
    compileResultFiles = await commands['clang++'](clangArgs, files, {
      stdout: (chunk: Uint8Array | null) => {
        if (!chunk) return;
        compileStdout += new TextDecoder().decode(chunk);
      },
      stderr: (chunk: Uint8Array | null) => {
        if (!chunk) return;
        compileStderr += new TextDecoder().decode(chunk);
      },
    });
  } catch (err: any) {
    if (compileStderr) {
      onStderr(compileStderr);
    } else {
      onStderr(`Compilation error: ${err?.message || err}\n`);
    }
    return { exitCode: 1 };
  }

  if (compileStderr) {
    onStderr(compileStderr);
  }

  const wasmBinaryRaw = compileResultFiles ? compileResultFiles['out.wasm'] : null;
  if (!wasmBinaryRaw) {
    onStderr('Error: Compilation produced no WebAssembly executable.\n');
    return { exitCode: 1 };
  }

  const wasmBinary: Uint8Array = wasmBinaryRaw instanceof Uint8Array
    ? new Uint8Array(wasmBinaryRaw.buffer.slice(wasmBinaryRaw.byteOffset, wasmBinaryRaw.byteOffset + wasmBinaryRaw.byteLength))
    : new Uint8Array(wasmBinaryRaw);

  onInfo?.(`Compilation successful (${wasmBinary.length} bytes). Executing WASI binary...\n`);

  // Set up WASI host environment
  const stdinFd = new StdinFd(stdin);
  const stdoutFd = new StreamFd({ onWrite: onStdout });
  const stderrFd = new StreamFd({ onWrite: onStderr });

  const fds = [stdinFd, stdoutFd, stderrFd];
  const wasi = new WASI(['out.wasm'], [], fds as any);

  try {
    const mod = await WebAssembly.compile(wasmBinary as unknown as BufferSource);
    const instance = await WebAssembly.instantiate(mod, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    const exitCode = wasi.start(instance as any);
    return { exitCode: typeof exitCode === 'number' ? exitCode : 0 };
  } catch (err: any) {
    if (err?.name === 'WASIProcExit') {
      return { exitCode: err.code || 0 };
    }
    onStderr(`Runtime error: ${err?.message || err}\n`);
    return { exitCode: 1 };
  }
}

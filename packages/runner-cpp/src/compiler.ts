import { Fd, WASI, File, PreopenDirectory } from '@bjorn3/browser_wasi_shim';
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

// Safe event loop yielder to ensure browser frame rendering during multi-step compilation
const yieldFrame = async () => {
  if (typeof requestAnimationFrame !== 'undefined') {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    });
  } else {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
};

export class StdinRequiredError extends Error {
  requestId: string;
  prompt: string;

  constructor(requestId: string, prompt: string = 'Enter input: ') {
    super('StdinRequiredError');
    this.name = 'StdinRequiredError';
    this.requestId = requestId;
    this.prompt = prompt;
  }
}

class StdinFd extends Fd {
  private buffer: Uint8Array = new Uint8Array(0);
  private offset: number = 0;
  private eofReached: boolean = false;
  private requestStdin?: () => string;
  private requestId: string;

  constructor(inputString?: string, requestStdin?: () => string, requestId: string = `cpp-stdin-${Date.now()}`) {
    super();
    this.requestStdin = requestStdin;
    this.requestId = requestId;
    if (inputString !== undefined && inputString !== '') {
      this.buffer = new TextEncoder().encode(inputString.endsWith('\n') ? inputString : inputString + '\n');
    }
  }

  override fd_read(size: number): { ret: number; data: Uint8Array } {
    if (this.offset >= this.buffer.length) {
      if (!this.eofReached && this.requestStdin) {
        const val = this.requestStdin();
        if (val !== undefined && val !== null && val !== '') {
          const formatted = val.endsWith('\n') ? val : val + '\n';
          this.buffer = new TextEncoder().encode(formatted);
          this.offset = 0;
        } else {
          this.eofReached = true;
        }
      } else if (!this.eofReached) {
        // Halt synchronous execution cleanly and prompt for stdin via terminal emulator
        throw new StdinRequiredError(this.requestId, 'Enter input: ');
      }
    }

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

export interface RuntimeEvent {
  type: 'stdin-request' | 'info';
  requestId: string;
  prompt?: string;
}

export interface CompileAndRunOptions {
  files: Record<string, string>;
  standard?: string;
  stdin?: string;
  requestStdin?: () => string;
  compiledWasm?: Uint8Array;
  onStdout: (text: string) => void;
  onStderr: (text: string) => void;
  onInfo?: (text: string) => void;
  onEvent?: (event: RuntimeEvent) => void;
}

export interface CompileAndRunResult {
  exitCode: number;
  compiledWasm?: Uint8Array;
  requiresStdin?: {
    requestId: string;
    prompt: string;
  };
}

/**
 * Converts a flat path-to-content map (e.g. {'src/main.cpp': '...'})
 * into a nested directory tree required by YoWASP virtual filesystem.
 */
function buildYoWASPFileSystem(files: Record<string, string>): Record<string, any> {
  const root: Record<string, any> = {};

  for (const [rawPath, content] of Object.entries(files)) {
    const cleanPath = rawPath.replace(/^[/\\]+/, '');
    const parts = cleanPath.split(/[/\\]+/);
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!current[dir] || typeof current[dir] !== 'object') {
        current[dir] = {};
      }
      current = current[dir];
    }

    const fileName = parts[parts.length - 1];
    current[fileName] = content;
  }

  return root;
}

const projectBinaryCache = new Map<string, Uint8Array>();
const objectFileCache = new Map<string, Uint8Array>();

function hashString(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function hashProject(files: Record<string, string>, standard: string): string {
  const keys = Object.keys(files).sort();
  let str = `${standard}\0`;
  for (const k of keys) {
    str += `${k}\0${files[k]}\0`;
  }
  return hashString(str);
}

export async function compileAndRunCpp(options: CompileAndRunOptions): Promise<CompileAndRunResult> {
  const { files, standard = 'c++17', stdin, requestStdin, compiledWasm, onStdout, onStderr, onInfo, onEvent } = options;

  let wasmBinary: Uint8Array;
  const projectKey = hashProject(files, standard);

  if (compiledWasm) {
    wasmBinary = compiledWasm;
  } else if (projectBinaryCache.has(projectKey)) {
    wasmBinary = projectBinaryCache.get(projectKey)!;
    onInfo?.(`Using cached WebAssembly binary (${wasmBinary.length} bytes). Executing WASI binary...\n`);
  } else {
    onInfo?.(`Compiling ${Object.keys(files).length} translation unit(s) with Clang (${standard})...\n`);

    // Build nested directory structure for YoWASP VFS
    const yoWASPFiles = buildYoWASPFileSystem(files);

    // Collect compilation source files and include directories
    const cppFiles = Object.keys(files).filter((f) => f.endsWith('.cpp') || f.endsWith('.cc') || f.endsWith('.c'));
    const includeDirs = new Set<string>();
    for (const f of Object.keys(files)) {
      const clean = f.replace(/^[/\\]+/, '');
      const lastSlash = clean.lastIndexOf('/');
      if (lastSlash > 0) {
        includeDirs.add(clean.substring(0, lastSlash));
      }
    }
    const includeFlags = Array.from(includeDirs).map((d) => `-I${d}`);

    // If multi-file project with unchanged files, perform incremental object file compilation
    let compileResultFiles: any;
    let compileStderr = '';
    let compileStdout = '';

    if (cppFiles.length > 1) {
      const objFiles: Record<string, Uint8Array> = {};
      const objPathsToLink: string[] = [];

      for (const cppPath of cppFiles) {
        const fileContent = files[cppPath];
        const fileKey = hashString(`${standard}\0${cppPath}\0${fileContent}`);
        const objFileName = `${cppPath.replace(/[/\\]+/g, '_')}.o`;
        objPathsToLink.push(objFileName);

        if (objectFileCache.has(fileKey)) {
          objFiles[objFileName] = objectFileCache.get(fileKey)!;
        } else {
          // Yield to let the browser breathe and animate the UI between translation units
          await yieldFrame();

          // Compile single compilation unit to .o
          let singleStderr = '';
          try {
            const singleRes = await commands['clang++'](
              [`-std=${standard}`, '-fno-exceptions', '-O2', ...includeFlags, '-c', cppPath, '-o', objFileName],
              yoWASPFiles,
              {
                stdout: () => {},
                stderr: (chunk: Uint8Array | null) => {
                  if (chunk) singleStderr += new TextDecoder().decode(chunk);
                },
              }
            );
            if (singleRes && singleRes[objFileName]) {
              const rawObj = singleRes[objFileName];
              const objData = rawObj instanceof Uint8Array
                ? new Uint8Array(rawObj.buffer.slice(rawObj.byteOffset, rawObj.byteOffset + rawObj.byteLength))
                : new TextEncoder().encode(String(rawObj));
              objectFileCache.set(fileKey, objData);
              objFiles[objFileName] = objData;
            } else {
              throw new Error(singleStderr || `Failed to compile ${cppPath}`);
            }
          } catch (err: any) {
            onStderr(singleStderr || `Compilation error in ${cppPath}: ${err?.message || err}\n`);
            return { exitCode: 1 };
          }
        }
      }

      // Link cached object files
      await yieldFrame();
      try {
        compileResultFiles = await commands['clang++'](
          [`-std=${standard}`, ...objPathsToLink, '-o', 'out.wasm'],
          objFiles,
          {
            stdout: (chunk: Uint8Array | null) => {
              if (chunk) compileStdout += new TextDecoder().decode(chunk);
            },
            stderr: (chunk: Uint8Array | null) => {
              if (chunk) compileStderr += new TextDecoder().decode(chunk);
            },
          }
        );
      } catch (err: any) {
        onStderr(compileStderr || `Linker error: ${err?.message || err}\n`);
        return { exitCode: 1 };
      }
    } else {
      // Single-file direct compilation
      const clangArgs = [`-std=${standard}`, '-fno-exceptions', '-O2', ...includeFlags, ...cppFiles, '-o', 'out.wasm'];
      try {
        compileResultFiles = await commands['clang++'](clangArgs, yoWASPFiles, {
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
    }

    if (compileStderr) {
      onStderr(compileStderr);
    }

    const wasmBinaryRaw = compileResultFiles ? compileResultFiles['out.wasm'] : null;
    if (!wasmBinaryRaw) {
      onStderr('Error: Compilation produced no WebAssembly executable.\n');
      return { exitCode: 1 };
    }

    wasmBinary = wasmBinaryRaw instanceof Uint8Array
      ? new Uint8Array(wasmBinaryRaw.buffer.slice(wasmBinaryRaw.byteOffset, wasmBinaryRaw.byteOffset + wasmBinaryRaw.byteLength))
      : new Uint8Array(wasmBinaryRaw);

    projectBinaryCache.set(projectKey, wasmBinary);
    onInfo?.(`Compilation successful (${wasmBinary.length} bytes). Executing WASI binary...\n`);
  }

  // Set up WASI host environment
  const stdinRequestId = `cpp-stdin-${Date.now()}`;
  const stdinFd = new StdinFd(stdin, requestStdin, stdinRequestId);
  const stdoutFd = new StreamFd({ onWrite: onStdout });
  const stderrFd = new StreamFd({ onWrite: onStderr });

  // Mount non-code project files (e.g. pets.txt, data.csv) into virtual filesystem root
  const dirContents = new Map<string, File>();
  const encoder = new TextEncoder();
  for (const [filename, content] of Object.entries(files)) {
    const isCode = filename.endsWith('.cpp') || filename.endsWith('.hpp') || filename.endsWith('.h') || filename.endsWith('.cc');
    if (!isCode) {
      // Clean path if leading slash
      const cleanName = filename.replace(/^[/\\]+/, '');
      dirContents.set(cleanName, new File(encoder.encode(content)));
    }
  }
  const preopenDir = new PreopenDirectory('.', dirContents);

  const fds = [stdinFd, stdoutFd, stderrFd, preopenDir];
  const wasi = new WASI(['out.wasm'], [], fds as any);

  try {
    const mod = await WebAssembly.compile(wasmBinary as unknown as BufferSource);
    const instance = await WebAssembly.instantiate(mod, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    const exitCode = wasi.start(instance as any);
    return {
      exitCode: typeof exitCode === 'number' ? exitCode : 0,
      compiledWasm: wasmBinary,
    };
  } catch (err: any) {
    if (err instanceof StdinRequiredError) {
      onEvent?.({
        type: 'stdin-request',
        requestId: err.requestId,
        prompt: err.prompt,
      });
      return {
        exitCode: 0,
        compiledWasm: wasmBinary,
        requiresStdin: {
          requestId: err.requestId,
          prompt: err.prompt,
        },
      };
    }
    if (err?.name === 'WASIProcExit') {
      return {
        exitCode: err.code || 0,
        compiledWasm: wasmBinary,
      };
    }
    onStderr(`Runtime error: ${err?.message || err}\n`);
    return { exitCode: 1, compiledWasm: wasmBinary };
  }
}

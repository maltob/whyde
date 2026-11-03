import { Project, RuntimeEvent } from '@ide/execution-contracts';

let cachedPyodidePromise: Promise<any> | null = null;

export async function getPyodideInstance(options?: { indexURL?: string; packageCacheDir?: string }) {
  if (!cachedPyodidePromise) {
    cachedPyodidePromise = (async () => {
      const pyodideModule = await import('pyodide');
      const load = pyodideModule.loadPyodide || (pyodideModule as any).default?.loadPyodide;
      const opts: any = {};

      if (options?.indexURL) {
        opts.indexURL = options.indexURL;
      }
      if (options?.packageCacheDir) {
        opts.packageCacheDir = options.packageCacheDir;
      } else if (typeof process !== 'undefined' && process.versions?.node) {
        try {
          const { createRequire } = await import('module');
          const pathModule = await import('path');
          const req = createRequire(import.meta.url);
          const pkgPath = req.resolve('pyodide/package.json');
          const pyodideDir = pathModule.dirname(pkgPath) + pathModule.sep;
          opts.packageCacheDir = pyodideDir;
          if (!opts.indexURL) {
            opts.indexURL = pyodideDir;
          }
        } catch (e) {
          console.warn('Could not auto-resolve pyodide path:', e);
        }
      }

      return await load(opts);
    })();
  }
  return await cachedPyodidePromise;
}

export interface PythonExecutionOptions {
  stdin?: string;
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
  onEvent?: (event: RuntimeEvent) => void;
  maxRunTimeMs?: number;
  indexURL?: string;
}

export async function executePythonInPyodide(
  project: Project,
  options: PythonExecutionOptions = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';

  const startTime = Date.now();
  const pyodide = await getPyodideInstance({ indexURL: options.indexURL });

  // Redirect stdout and stderr
  pyodide.setStdout({
    batched: (text: string) => {
      const line = text + '\n';
      stdout += line;
      options.onStdout?.(line);
      options.onEvent?.({ type: 'stdout', text: line });
    },
  });

  pyodide.setStderr({
    batched: (text: string) => {
      const line = text + '\n';
      stderr += line;
      options.onStderr?.(line);
      options.onEvent?.({ type: 'stderr', text: line });
    },
  });

  // Stdin handling if provided
  if (options.stdin !== undefined) {
    const lines = options.stdin.split('\n');
    pyodide.setStdin({
      isatty: true,
      stdin: () => {
        if (lines.length > 0) {
          return lines.shift() ?? '';
        }
        return '';
      },
    });
  }

  // Mount/write project files to Pyodide FS
  for (const file of project.files) {
    const normPath = file.path.startsWith('/') ? file.path : '/' + file.path;
    const lastSlash = normPath.lastIndexOf('/');
    if (lastSlash > 0) {
      const dir = normPath.substring(0, lastSlash);
      try {
        pyodide.FS.mkdirTree(dir);
      } catch {}
    }
    try {
      pyodide.FS.writeFile(normPath, file.content);
    } catch (e) {
      console.warn('Failed to write file to Pyodide FS:', normPath, e);
    }
  }

  // Ensure entrypoint directory is in sys.path
  const entryPath = project.entrypoint.startsWith('/') ? project.entrypoint : '/' + project.entrypoint;
  const entryDir = entryPath.substring(0, entryPath.lastIndexOf('/')) || '/';
  await pyodide.runPythonAsync(`
import sys
if '${entryDir}' not in sys.path:
    sys.path.insert(0, '${entryDir}')
`);

  const entryFile = project.files.find((f) => f.path === project.entrypoint || '/' + f.path === entryPath);
  const codeToRun = entryFile?.content ?? '';

  try {
    await pyodide.runPythonAsync(codeToRun);
    const durationMs = Date.now() - startTime;
    options.onEvent?.({
      type: 'complete',
      exitCode: 0,
      durationMs,
      reason: 'success',
    });
    return { exitCode: 0, stdout, stderr };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    stderr += errMsg + '\n';
    options.onStderr?.(errMsg + '\n');
    options.onEvent?.({ type: 'stderr', text: errMsg + '\n' });

    const lineMatch = errMsg.match(/File "[^"]*", line (\d+)/);
    const lineNum = lineMatch ? parseInt(lineMatch[1], 10) : undefined;

    options.onEvent?.({
      type: 'diagnostic',
      file: project.entrypoint,
      line: lineNum,
      severity: 'error',
      message: errMsg,
    });

    const durationMs = Date.now() - startTime;
    options.onEvent?.({
      type: 'complete',
      exitCode: 1,
      durationMs,
      reason: 'exception',
    });
    return { exitCode: 1, stdout, stderr };
  }
}

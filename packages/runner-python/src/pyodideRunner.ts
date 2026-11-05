import { Project, RuntimeEvent } from '@ide/execution-contracts';
import { TURTLE_SHIM_PY } from './turtleShim.js';

let cachedPyodidePromise: Promise<any> | null = null;

export async function getPyodideInstance(options?: { indexURL?: string; packageCacheDir?: string }) {
  if (!cachedPyodidePromise) {
    cachedPyodidePromise = (async () => {
      const pyodideModule = await import('pyodide');
      const load = pyodideModule.loadPyodide || (pyodideModule as any).default?.loadPyodide;
      const opts: any = {};

      if (options?.indexURL) {
        opts.indexURL = options.indexURL;
      } else if (typeof window !== 'undefined' || typeof self !== 'undefined') {
        // In browser / web worker environment, default to CDN indexURL so pyodide.asm.mjs and wasm fetch properly
        opts.indexURL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
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
  packages?: string[];
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
  onEvent?: (event: RuntimeEvent) => void;
  onPlot?: (dataUrl: string) => void;
  maxRunTimeMs?: number;
  indexURL?: string;
  requestStdin?: (prompt: string) => Promise<string>;
}

export async function executePythonInPyodide(
  project: Project,
  options: PythonExecutionOptions = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';

  const startTime = Date.now();
  const pyodide = await getPyodideInstance({ indexURL: options.indexURL });

  // Auto-detect or include requested packages (numpy, pandas, regex, pytest, matplotlib, scikit-learn, pillow, requests, hypothesis)
  const packagesToLoad = new Set<string>(options.packages || []);
  const allCode = project.files.map((f) => f.content).join('\n');

  if (/\b(import\s+numpy|from\s+numpy)\b/.test(allCode)) packagesToLoad.add('numpy');
  if (/\b(import\s+pandas|from\s+pandas)\b/.test(allCode)) packagesToLoad.add('pandas');
  if (/\b(import\s+regex|from\s+regex)\b/.test(allCode)) packagesToLoad.add('regex');
  if (/\b(import\s+pytest|from\s+pytest)\b/.test(allCode)) packagesToLoad.add('pytest');
  if (/\b(import\s+matplotlib|from\s+matplotlib)\b/.test(allCode)) packagesToLoad.add('matplotlib');
  if (/\b(import\s+sklearn|from\s+sklearn)\b/.test(allCode)) packagesToLoad.add('scikit-learn');
  if (/\b(import\s+PIL|from\s+PIL|import\s+pillow|from\s+pillow)\b/.test(allCode)) packagesToLoad.add('pillow');
  if (/\b(import\s+requests|from\s+requests)\b/.test(allCode)) {
    packagesToLoad.add('requests');
    packagesToLoad.add('pyodide-http');
  }
  if (/\b(import\s+hypothesis|from\s+hypothesis)\b/.test(allCode)) {
    packagesToLoad.add('hypothesis');
  }

  if (packagesToLoad.size > 0 && typeof pyodide.loadPackage === 'function') {
    try {
      await pyodide.loadPackage(Array.from(packagesToLoad));
    } catch (e) {
      console.warn('Could not load requested packages:', Array.from(packagesToLoad), e);
    }
  }

  // If requests is loaded, automatically patch requests/urllib with pyodide-http
  if (packagesToLoad.has('requests')) {
    try {
      await pyodide.runPythonAsync(`
try:
    import pyodide_http
    pyodide_http.patch_all()
except Exception:
    pass
`);
    } catch {}
  }

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

  // Stdin handling
  const lines = options.stdin !== undefined && options.stdin !== '' ? options.stdin.split('\n') : [];
  
  // Custom input & visual plot bridging
  try {
    pyodide.registerJsModule('_ide_runner_io', {
      get_input: async (promptText?: string) => {
        if (lines.length > 0) {
          const val = lines.shift() ?? '';
          if (promptText) {
            options.onStdout?.(promptText + val + '\n');
            options.onEvent?.({ type: 'stdout', text: promptText + val + '\n' });
          }
          return val;
        }
        if (options.requestStdin) {
          if (promptText) {
            options.onStdout?.(promptText);
            options.onEvent?.({ type: 'stdout', text: promptText });
          }
          const val = await options.requestStdin(promptText || '');
          return val !== null ? val : '';
        }
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          try {
            const res = window.prompt(promptText || 'Enter input:');
            const val = res !== null ? res : '';
            if (promptText) {
              options.onStdout?.(promptText + val + '\n');
              options.onEvent?.({ type: 'stdout', text: promptText + val + '\n' });
            }
            return val;
          } catch {
            // window.prompt blocked by iframe/browser security policies
          }
        }
        return '';
      },
      show_plot: (dataUrl: string) => {
        options.onPlot?.(dataUrl);
        options.onEvent?.({ type: 'plot', dataUrl });
      },
    });
  } catch {}

  pyodide.setStdin({
    isatty: true,
    stdin: () => {
      if (lines.length > 0) {
        return lines.shift() ?? '';
      }
      return '';
    },
  });

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

  // Ensure entrypoint directory is in sys.path and is the current working directory,
  // and bind custom input handler if available
  const entryPath = project.entrypoint.startsWith('/') ? project.entrypoint : '/' + project.entrypoint;
  const entryDir = entryPath.substring(0, entryPath.lastIndexOf('/')) || '/';

  // Provide browser-compatible turtle shim in Pyodide FS if user code imports turtle
  const allCodeCheck = project.files.map((f) => f.content).join('\n');
  if (/\b(import\s+turtle|from\s+turtle)\b/.test(allCodeCheck)) {
    try {
      pyodide.FS.writeFile('/turtle.py', TURTLE_SHIM_PY);
      if (entryDir !== '/') {
        pyodide.FS.writeFile(`${entryDir}/turtle.py`, TURTLE_SHIM_PY);
      }
    } catch {}
  }
  await pyodide.runPythonAsync(`
import sys, os, builtins, ast
if '${entryDir}' not in sys.path:
    sys.path.insert(0, '${entryDir}')
try:
    os.chdir('${entryDir}')
except Exception:
    pass

try:
    import _ide_runner_io
    builtins.input = _ide_runner_io.get_input
except Exception:
    pass

try:
    import matplotlib
    import matplotlib.pyplot as _plt
    import io, base64

    def _ide_show_plot(*args, **kwargs):
        try:
            buf = io.BytesIO()
            _plt.savefig(buf, format="png", bbox_inches="tight")
            buf.seek(0)
            b64_data = base64.b64encode(buf.read()).decode("utf-8")
            _plt.close("all")
            if b64_data:
                _ide_runner_io.show_plot(f"data:image/png;base64,{b64_data}")
        except Exception as e:
            print(f"[Matplotlib error]: {e}", file=sys.stderr)

    _plt.show = _ide_show_plot
except Exception:
    pass

def _transform_async_inputs(source_code):
    try:
        tree = ast.parse(source_code)
        async_funcs = set()
        changed = True
        while changed:
            size_before = len(async_funcs)
            for n in ast.walk(tree):
                if isinstance(n, ast.FunctionDef):
                    if any(isinstance(c, ast.Call) and isinstance(c.func, ast.Name) and (c.func.id == 'input' or c.func.id in async_funcs) for c in ast.walk(n)):
                        async_funcs.add(n.name)
            changed = len(async_funcs) > size_before

        if not async_funcs and not any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == 'input' for n in ast.walk(tree)):
            return source_code

        class _InputTransformer(ast.NodeTransformer):
            def visit_Call(self, node):
                self.generic_visit(node)
                if isinstance(node.func, ast.Name):
                    if node.func.id == 'input' or node.func.id in async_funcs:
                        return ast.Await(value=node)
                return node

            def visit_FunctionDef(self, node):
                is_async = node.name in async_funcs or any(
                    isinstance(c, ast.Call) and isinstance(c.func, ast.Name) and (c.func.id == 'input' or c.func.id in async_funcs)
                    for c in ast.walk(node)
                )
                self.generic_visit(node)
                if is_async:
                    return ast.AsyncFunctionDef(
                        name=node.name,
                        args=node.args,
                        body=node.body,
                        decorator_list=node.decorator_list,
                        returns=node.returns,
                        type_comment=getattr(node, 'type_comment', None),
                        type_params=getattr(node, 'type_params', [])
                    )
                return node

        tree = _InputTransformer().visit(tree)
        ast.fix_missing_locations(tree)
        return ast.unparse(tree)
    except Exception:
        return source_code
`);

  const entryFile = project.files.find((f) => f.path === project.entrypoint || '/' + f.path === entryPath);
  const codeToRun = entryFile?.content ?? '';

  try {
    pyodide.globals.set('_raw_user_code', codeToRun);
    const transformedCode = await pyodide.runPythonAsync('_transform_async_inputs(_raw_user_code)');
    await pyodide.runPythonAsync(transformedCode);
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

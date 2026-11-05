import { loadPyodide } from 'pyodide';
import { MainToWorkerMessage } from './index.js';
import { TURTLE_SHIM_PY } from './turtleShim.js';

let pyodideInstance: any = null;
let stdinQueue: string[] = [];

async function getPyodide(indexURL?: string) {
  if (!pyodideInstance) {
    const defaultIndex = indexURL || 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
    pyodideInstance = await loadPyodide({ indexURL: defaultIndex });
  }
  return pyodideInstance;
}

self.onmessage = async (event: MessageEvent<MainToWorkerMessage>) => {
  const msg = event.data;

  if (msg.type === 'stdin-response') {
    stdinQueue.push(msg.text);
    return;
  }

  if (msg.type === 'run') {
    const request = msg.request;
    const startTime = Date.now();
    stdinQueue = request.stdin !== undefined ? request.stdin.split('\n') : [];

    try {
      const pyodide = await getPyodide();

      // Auto-detect or include requested packages (numpy, pandas, regex, pytest, matplotlib, scikit-learn, pillow, requests, hypothesis)
      const packagesToLoad = new Set<string>();
      const allCode = request.project.files.map((f) => f.content).join('\n');

      if (/\b(import\s+numpy|from\s+numpy)\b/.test(allCode)) packagesToLoad.add('numpy');
      if (/\b(import\s+pandas|from\s+pandas)\b/.test(allCode)) packagesToLoad.add('pandas');
      if (/\b(import\s+seaborn|from\s+seaborn)\b/.test(allCode)) packagesToLoad.add('seaborn');
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

      pyodide.setStdout({
        batched: (text: string) => {
          (self as any).postMessage({ type: 'stdout', text: text + '\n' });
        },
      });

      pyodide.setStderr({
        batched: (text: string) => {
          (self as any).postMessage({ type: 'stderr', text: text + '\n' });
        },
      });

      const lines = request.stdin !== undefined && request.stdin !== '' ? request.stdin.split('\n') : [];
      pyodide.setStdin({
        isatty: true,
        stdin: () => {
          if (stdinQueue.length > 0) {
            return stdinQueue.shift() ?? '';
          }
          if (lines.length > 0) {
            return lines.shift() ?? '';
          }
          return '';
        },
      });

      // Write project files to virtual filesystem
      for (const file of request.project.files) {
        const normPath = file.path.startsWith('/') ? file.path : '/' + file.path;
        const lastSlash = normPath.lastIndexOf('/');
        if (lastSlash > 0) {
          const dir = normPath.substring(0, lastSlash);
          try {
            pyodide.FS.mkdirTree(dir);
          } catch {}
        }
        pyodide.FS.writeFile(normPath, file.content);
      }

      if (/\b(import\s+turtle|from\s+turtle)\b/.test(allCode)) {
        try {
          pyodide.FS.writeFile('/turtle.py', TURTLE_SHIM_PY);
        } catch {}
      }

      const entryPath = request.project.entrypoint.startsWith('/')
        ? request.project.entrypoint
        : '/' + request.project.entrypoint;
      const entryDir = entryPath.substring(0, entryPath.lastIndexOf('/')) || '/';
      await pyodide.runPythonAsync(`
import sys, os
if '${entryDir}' not in sys.path:
    sys.path.insert(0, '${entryDir}')
try:
    os.chdir('${entryDir}')
except Exception:
    pass
`);

      const entryFile = request.project.files.find(
        (f) => f.path === request.project.entrypoint || '/' + f.path === entryPath
      );
      const code = entryFile ? entryFile.content : '';

      await pyodide.runPythonAsync(code);

      (self as any).postMessage({
        type: 'complete',
        exitCode: 0,
        durationMs: Date.now() - startTime,
        reason: 'success',
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      (self as any).postMessage({ type: 'stderr', text: errMsg + '\n' });
      (self as any).postMessage({
        type: 'complete',
        exitCode: 1,
        durationMs: Date.now() - startTime,
        reason: 'exception',
      });
    }
  }
};

import { loadPyodide } from 'pyodide';
import { MainToWorkerMessage } from './index.js';

let pyodideInstance: any = null;

async function getPyodide(indexURL?: string) {
  if (!pyodideInstance) {
    pyodideInstance = await loadPyodide(indexURL ? { indexURL } : undefined);
  }
  return pyodideInstance;
}

self.onmessage = async (event: MessageEvent<MainToWorkerMessage>) => {
  const msg = event.data;

  if (msg.type === 'run') {
    const request = msg.request;
    const startTime = Date.now();

    try {
      const pyodide = await getPyodide();

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

      const entryPath = request.project.entrypoint.startsWith('/')
        ? request.project.entrypoint
        : '/' + request.project.entrypoint;
      const entryDir = entryPath.substring(0, entryPath.lastIndexOf('/')) || '/';
      await pyodide.runPythonAsync(`
import sys
if '${entryDir}' not in sys.path:
    sys.path.insert(0, '${entryDir}')
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

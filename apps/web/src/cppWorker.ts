import { compileAndRunCpp } from '@ide/runner-cpp';

self.onmessage = async (e: MessageEvent) => {
  const { type, files, standard, stdin } = e.data;
  if (type === 'run') {
    try {
      const result = await compileAndRunCpp({
        files,
        standard: standard || 'c++17',
        stdin: stdin || '',
        onStdout: (text: string) => self.postMessage({ type: 'stdout', text }),
        onStderr: (text: string) => self.postMessage({ type: 'stderr', text }),
        onInfo: (text: string) => self.postMessage({ type: 'info', text }),
      });
      self.postMessage({ type: 'complete', exitCode: result.exitCode });
    } catch (err: any) {
      self.postMessage({
        type: 'stderr',
        text: `Execution failed: ${err?.message || err}\n`,
      });
      self.postMessage({ type: 'complete', exitCode: 1 });
    }
  }
};

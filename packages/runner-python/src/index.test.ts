import { describe, it, expect, vi } from 'vitest';
import {
  PythonRuntimeProvider,
  PythonWorkerBridge,
  MainToWorkerMessage,
  WorkerToMainMessage,
} from './index.js';
import { Project, RunRequest, RuntimeEvent } from '@ide/execution-contracts';

class MockPythonWorker implements PythonWorkerBridge {
  onmessage: ((event: { data: WorkerToMainMessage }) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  public terminated = false;
  public sentMessages: MainToWorkerMessage[] = [];

  postMessage(msg: MainToWorkerMessage) {
    this.sentMessages.push(msg);

    if (msg.type === 'run') {
      const code = msg.request.project.files.find(
        (f) => f.path === msg.request.project.entrypoint
      )?.content;

      // Simulate stdout streaming
      if (code?.includes('print("Hello")')) {
        setTimeout(() => {
          this.onmessage?.({ data: { type: 'stdout', text: 'Hello\n' } });
          this.onmessage?.({
            data: {
              type: 'complete',
              exitCode: 0,
              durationMs: 12,
              reason: 'success',
            },
          });
        }, 10);
      } else if (code?.includes('input(')) {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: 'stdin-request',
              requestId: 'req-input-1',
              prompt: 'Enter name: ',
            },
          });
        }, 10);
      } else if (code?.includes('syntax error')) {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: 'diagnostic',
              file: 'src/main.py',
              line: 3,
              column: 5,
              severity: 'error',
              message: 'invalid syntax',
            },
          });
          this.onmessage?.({
            data: {
              type: 'complete',
              exitCode: 1,
              durationMs: 5,
              reason: 'compile-error',
            },
          });
        }, 10);
      }
    } else if (msg.type === 'stdin-response') {
      setTimeout(() => {
        this.onmessage?.({ data: { type: 'stdout', text: `Hi ${msg.text}\n` } });
        this.onmessage?.({
          data: {
            type: 'complete',
            exitCode: 0,
            durationMs: 20,
            reason: 'success',
          },
        });
      }, 10);
    }
  }

  terminate() {
    this.terminated = true;
  }
}

describe('PythonRuntimeProvider (Milestone 2 - IDE-009)', () => {
  const sampleProject: Project = {
    schemaVersion: 1,
    id: 'py-proj',
    name: 'Python Test',
    language: 'python',
    entrypoint: 'src/main.py',
    files: [
      {
        path: 'src/main.py',
        encoding: 'utf-8',
        content: 'print("Hello")',
      },
    ],
    toolchain: { runtimeId: 'python-pyodide', requestedVersion: '314.0.7' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('probes available Pyodide runtime', async () => {
    const provider = new PythonRuntimeProvider();
    const probe = await provider.probe();
    expect(probe.available).toBe(true);
    expect(probe.versions).toContain('3.14.2');
  });

  it('executes python program with streamed stdout', async () => {
    let mockWorker: MockPythonWorker;
    const provider = new PythonRuntimeProvider(() => {
      mockWorker = new MockPythonWorker();
      return mockWorker;
    });

    const events: RuntimeEvent[] = [];
    const runReq: RunRequest = {
      runId: 'run-100',
      project: sampleProject,
      settings: {
        maxRunTimeMs: 2000,
        maxOutputBytes: 1024,
        maxFiles: 10,
        maxProjectBytes: 1024,
      },
      mode: 'normal',
    };

    await provider.run(runReq, (e) => events.push(e));

    const stdoutEvent = events.find((e) => e.type === 'stdout');
    expect(stdoutEvent).toEqual({ type: 'stdout', text: 'Hello\n' });

    const completeEvent = events.find((e) => e.type === 'complete');
    expect(completeEvent).toBeDefined();
    if (completeEvent && completeEvent.type === 'complete') {
      expect(completeEvent.exitCode).toBe(0);
      expect(completeEvent.reason).toBe('success');
    }
  });

  it('handles interactive stdin flow mid-run', async () => {
    const inputProject: Project = {
      ...sampleProject,
      files: [
        {
          path: 'src/main.py',
          encoding: 'utf-8',
          content: 'name = input("Enter name: ")\nprint("Hi " + name)',
        },
      ],
    };

    let mockWorker!: MockPythonWorker;
    const provider = new PythonRuntimeProvider(() => {
      mockWorker = new MockPythonWorker();
      return mockWorker;
    });

    const events: RuntimeEvent[] = [];
    const runReq: RunRequest = {
      runId: 'run-input',
      project: inputProject,
      settings: {
        maxRunTimeMs: 2000,
        maxOutputBytes: 1024,
        maxFiles: 10,
        maxProjectBytes: 1024,
      },
      mode: 'normal',
    };

    const runPromise = provider.run(runReq, (e) => {
      events.push(e);
      if (e.type === 'stdin-request') {
        provider.supplyInput('run-input', e.requestId, 'Guido');
      }
    });

    await runPromise;

    const stdinRequest = events.find((e) => e.type === 'stdin-request');
    expect(stdinRequest).toBeDefined();

    const stdout = events.find((e) => e.type === 'stdout' && e.text.includes('Guido'));
    expect(stdout).toBeDefined();
  });

  it('terminates worker on stop', async () => {
    let mockWorker!: MockPythonWorker;
    const provider = new PythonRuntimeProvider(() => {
      mockWorker = new MockPythonWorker();
      return mockWorker;
    });

    // Start long run
    const loopProject: Project = {
      ...sampleProject,
      files: [
        {
          path: 'src/main.py',
          encoding: 'utf-8',
          content: 'while True: pass',
        },
      ],
    };

    const runReq: RunRequest = {
      runId: 'run-stop',
      project: loopProject,
      settings: {
        maxRunTimeMs: 5000,
        maxOutputBytes: 1024,
        maxFiles: 10,
        maxProjectBytes: 1024,
      },
      mode: 'normal',
    };

    provider.run(runReq, () => {});
    await provider.stop('run-stop');

    expect(mockWorker.terminated).toBe(true);
  });

  it('runs real CPython test suite code using unittest.suite in Pyodide', async () => {
    const { executePythonInPyodide } = await import('./pyodideRunner.js');

    const cpythonSuiteProject: Project = {
      schemaVersion: 1,
      id: 'cpython-unittest-suite',
      name: 'CPython Unittest Suite',
      language: 'python',
      entrypoint: 'test_suite_runner.py',
      files: [
        {
          path: 'test_suite_runner.py',
          encoding: 'utf-8',
          content: `
import unittest
import unittest.suite
import io

class SampleTestCase(unittest.TestCase):
    def test_success(self):
        self.assertEqual(2 * 3, 6)

    def test_suite_type(self):
        suite = unittest.suite.TestSuite()
        self.assertIsInstance(suite, unittest.suite.BaseTestSuite)
        self.assertEqual(suite.countTestCases(), 0)

suite = unittest.TestSuite()
suite.addTest(SampleTestCase('test_success'))
suite.addTest(SampleTestCase('test_suite_type'))

stream = io.StringIO()
runner = unittest.TextTestRunner(stream=stream, verbosity=2)
result = runner.run(suite)

print(f"CPython unittest results: ran={result.testsRun}, errors={len(result.errors)}, failures={len(result.failures)}")
`,
        },
      ],
      toolchain: { runtimeId: 'python-pyodide', requestedVersion: '314.0.7' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await executePythonInPyodide(cpythonSuiteProject);
    expect(res.exitCode).toBe(0);
    expect(res.stderr).toBe('');
    expect(res.stdout).toContain('CPython unittest results: ran=2, errors=0, failures=0');
  }, 30000);

  it('supports directory traversal with relative paths (..)', async () => {
    const { executePythonInPyodide } = await import('./pyodideRunner.js');
    const projectWithRelativeDir: Project = {
      schemaVersion: 1,
      name: 'Relative Path Test',
      language: 'python',
      id: 'proj-rel-path',
      entrypoint: 'src/main.py',
      files: [
        {
          path: 'cats.txt',
          encoding: 'utf-8',
          content: 'Oliver\nLuna\nMilo\n',
        },
        {
          path: 'src/main.py',
          encoding: 'utf-8',
          content: `
file_path = "../cats.txt"
with open(file_path, "r") as f:
    for line in f:
        print(line.strip())
`,
        },
      ],
      toolchain: { runtimeId: 'python-pyodide', requestedVersion: '314.0.7' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await executePythonInPyodide(projectWithRelativeDir);
    expect(res.exitCode).toBe(0);
    expect(res.stderr).toBe('');
    expect(res.stdout).toBe('Oliver\nLuna\nMilo\n');
  }, 30000);
});

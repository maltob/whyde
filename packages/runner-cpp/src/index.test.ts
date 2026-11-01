import { describe, it, expect } from 'vitest';
import { CppRuntimeProvider, CppWorkerBridge } from './index.js';
import { Project, RunRequest, RuntimeEvent } from '@ide/execution-contracts';

class MockCppWorker implements CppWorkerBridge {
  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  public terminated = false;
  public sentMessages: any[] = [];

  postMessage(msg: any) {
    this.sentMessages.push(msg);

    if (msg.type === 'compile-and-run') {
      const mainFile = msg.request.project.files.find(
        (f: any) => f.path === msg.request.project.entrypoint
      )?.content;

      if (mainFile?.includes('syntax_error')) {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: 'diagnostic',
              file: 'src/main.cpp',
              line: 6,
              column: 5,
              severity: 'error',
              message: "expected ';' after expression",
            },
          });
          this.onmessage?.({
            data: {
              type: 'complete',
              exitCode: 1,
              durationMs: 40,
              reason: 'compile-error',
            },
          });
        }, 10);
      } else if (mainFile?.includes('std::cin')) {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: 'stdin-request',
              requestId: 'cin-req-1',
              prompt: 'Enter favorite language: ',
            },
          });
        }, 10);
      } else {
        setTimeout(() => {
          this.onmessage?.({
            data: { type: 'stdout', text: 'Hello from C++17!\n' },
          });
          this.onmessage?.({
            data: {
              type: 'complete',
              exitCode: 0,
              durationMs: 85,
              reason: 'success',
            },
          });
        }, 10);
      }
    } else if (msg.type === 'stdin-response') {
      setTimeout(() => {
        this.onmessage?.({
          data: { type: 'stdout', text: `Read: ${msg.text}\n` },
        });
        this.onmessage?.({
          data: {
            type: 'complete',
            exitCode: 0,
            durationMs: 110,
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

describe('CppRuntimeProvider (Milestone 3 - IDE-010)', () => {
  const multiFileCppProject: Project = {
    schemaVersion: 1,
    id: 'cpp-proj-1',
    name: 'Multi-file C++17',
    language: 'cpp',
    entrypoint: 'src/main.cpp',
    files: [
      {
        path: 'src/main.cpp',
        encoding: 'utf-8',
        content: '#include <iostream>\n#include "helper.hpp"\nint main() { greet(); return 0; }',
      },
      {
        path: 'src/helper.hpp',
        encoding: 'utf-8',
        content: '#pragma once\nvoid greet();',
      },
      {
        path: 'src/helper.cpp',
        encoding: 'utf-8',
        content: '#include <iostream>\nvoid greet() { std::cout << "Hello from C++17!\\n"; }',
      },
    ],
    toolchain: { runtimeId: 'cpp-yowasp', requestedVersion: '17' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('probes C++ toolchain and validates version standards', async () => {
    const provider = new CppRuntimeProvider();
    const probe = await provider.probe();
    expect(probe.available).toBe(true);
    expect(probe.versions).toContain('C++17');
    expect(probe.versions).toContain('C++20');

    const manifest = provider.getManifest();
    expect(manifest.compiler.name).toBe('clang.wasm');
    expect(manifest.linker.name).toBe('lld.wasm');
    expect(manifest.license).toContain('Apache-2.0');
  });

  it('compiles and links multi-file C++ project with streamed stdout', async () => {
    let mockWorker!: MockCppWorker;
    const provider = new CppRuntimeProvider(undefined, () => {
      mockWorker = new MockCppWorker();
      return mockWorker;
    });

    const events: RuntimeEvent[] = [];
    const runReq: RunRequest = {
      runId: 'cpp-run-1',
      project: multiFileCppProject,
      settings: {
        maxRunTimeMs: 5000,
        maxOutputBytes: 4096,
        maxFiles: 10,
        maxProjectBytes: 4096,
      },
      mode: 'normal',
    };

    await provider.run(runReq, (e) => events.push(e));

    const stdout = events.find((e) => e.type === 'stdout');
    expect(stdout).toEqual({ type: 'stdout', text: 'Hello from C++17!\n' });

    const complete = events.find((e) => e.type === 'complete');
    expect(complete).toBeDefined();
    if (complete?.type === 'complete') {
      expect(complete.exitCode).toBe(0);
      expect(complete.reason).toBe('success');
    }
  });

  it('captures compiler diagnostics for C++ syntax errors', async () => {
    const badCppProject: Project = {
      ...multiFileCppProject,
      files: [
        {
          path: 'src/main.cpp',
          encoding: 'utf-8',
          content: 'int main() { syntax_error }',
        },
      ],
    };

    let mockWorker!: MockCppWorker;
    const provider = new CppRuntimeProvider(undefined, () => {
      mockWorker = new MockCppWorker();
      return mockWorker;
    });

    const events: RuntimeEvent[] = [];
    const runReq: RunRequest = {
      runId: 'cpp-run-error',
      project: badCppProject,
      settings: {
        maxRunTimeMs: 5000,
        maxOutputBytes: 4096,
        maxFiles: 10,
        maxProjectBytes: 4096,
      },
      mode: 'normal',
    };

    await provider.run(runReq, (e) => events.push(e));

    const diagnostic = events.find((e) => e.type === 'diagnostic');
    expect(diagnostic).toBeDefined();
    if (diagnostic?.type === 'diagnostic') {
      expect(diagnostic.file).toBe('src/main.cpp');
      expect(diagnostic.line).toBe(6);
      expect(diagnostic.message).toContain("expected ';'");
    }
  });

  it('bridges interactive std::cin input mid-run', async () => {
    const cinProject: Project = {
      ...multiFileCppProject,
      files: [
        {
          path: 'src/main.cpp',
          encoding: 'utf-8',
          content: '#include <iostream>\nint main() { std::string s; std::cin >> s; }',
        },
      ],
    };

    let mockWorker!: MockCppWorker;
    const provider = new CppRuntimeProvider(undefined, () => {
      mockWorker = new MockCppWorker();
      return mockWorker;
    });

    const events: RuntimeEvent[] = [];
    const runReq: RunRequest = {
      runId: 'cpp-run-cin',
      project: cinProject,
      settings: {
        maxRunTimeMs: 5000,
        maxOutputBytes: 4096,
        maxFiles: 10,
        maxProjectBytes: 4096,
      },
      mode: 'normal',
    };

    const runPromise = provider.run(runReq, (e) => {
      events.push(e);
      if (e.type === 'stdin-request') {
        provider.supplyInput('cpp-run-cin', e.requestId, 'Rust');
      }
    });

    await runPromise;

    const stdinRequest = events.find((e) => e.type === 'stdin-request');
    expect(stdinRequest).toBeDefined();

    const stdout = events.find((e) => e.type === 'stdout');
    expect(stdout).toEqual({ type: 'stdout', text: 'Read: Rust\n' });
  });
});

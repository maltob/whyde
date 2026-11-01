import { describe, it, expect } from 'vitest';
import type { LanguageId, Project, RuntimeEvent, RuntimeProvider } from './index.js';

describe('Execution Contracts', () => {
  it('validates mock runtime provider adhering to interface', async () => {
    const events: RuntimeEvent[] = [];
    const mockProvider: RuntimeProvider = {
      id: 'mock-runner',
      language: 'python',
      async probe() {
        return { available: true, versions: ['3.14.0'] };
      },
      async prepare() {},
      async run(req, onEvent) {
        onEvent({ type: 'status', status: 'running' });
        onEvent({ type: 'stdout', text: `Running ${req.project.name}\n` });
        onEvent({
          type: 'complete',
          exitCode: 0,
          durationMs: 15,
          reason: 'success',
        });
      },
      async supplyInput() {},
      async stop() {},
      async dispose() {},
    };

    const probe = await mockProvider.probe();
    expect(probe.available).toBe(true);
    expect(probe.versions).toContain('3.14.0');

    const project: Project = {
      schemaVersion: 1,
      id: 'test-proj',
      name: 'Hello',
      language: 'python',
      entrypoint: 'main.py',
      files: [{ path: 'main.py', encoding: 'utf-8', content: 'print("Hello")\n' }],
      toolchain: { runtimeId: 'mock-runner', requestedVersion: '3.14.0' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await mockProvider.run(
      {
        runId: 'run-1',
        project,
        settings: {
          maxRunTimeMs: 5000,
          maxOutputBytes: 1024,
          maxFiles: 10,
          maxProjectBytes: 1024,
        },
        mode: 'normal',
      },
      (e) => events.push(e)
    );

    expect(events.length).toBe(3);
    expect(events[1]).toEqual({ type: 'stdout', text: 'Running Hello\n' });
    expect(events[2].type).toBe('complete');
  });
});

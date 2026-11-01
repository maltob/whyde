import { describe, it, expect } from 'vitest';
import { validateProject, Project } from './index.js';

describe('Project Model Validation', () => {
  it('accepts a valid project schema', () => {
    const raw = {
      schemaVersion: 1,
      kind: 'browser-ide-project',
      id: 'proj-123',
      name: 'Python Starter',
      language: 'python',
      entrypoint: 'src/main.py',
      files: [
        {
          path: 'src/main.py',
          encoding: 'utf-8',
          content: 'print("Hello, world!")\n',
        },
      ],
      toolchain: {
        runtimeId: 'python-pyodide',
        requestedVersion: '3.14.0',
      },
      createdAt: '2026-11-01T12:00:00Z',
      updatedAt: '2026-11-01T12:00:00Z',
    };

    const result = validateProject(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.project.name).toBe('Python Starter');
    }
  });

  it('rejects directory traversal and absolute paths in files', () => {
    const raw = {
      schemaVersion: 1,
      kind: 'browser-ide-project',
      id: 'proj-bad',
      name: 'Bad Proj',
      language: 'python',
      entrypoint: '../secret.py',
      files: [
        {
          path: '../secret.py',
          encoding: 'utf-8',
          content: 'bad',
        },
      ],
      toolchain: { runtimeId: 'python-pyodide', requestedVersion: '3.14.0' },
      createdAt: '2026-11-01T12:00:00Z',
      updatedAt: '2026-11-01T12:00:00Z',
    };

    const result = validateProject(raw);
    expect(result.success).toBe(false);
  });

  it('rejects missing entrypoint', () => {
    const raw = {
      schemaVersion: 1,
      kind: 'browser-ide-project',
      id: 'proj-no-entry',
      name: 'No Entry',
      language: 'python',
      entrypoint: 'main.py',
      files: [
        {
          path: 'other.py',
          encoding: 'utf-8',
          content: 'foo',
        },
      ],
      toolchain: { runtimeId: 'python-pyodide', requestedVersion: '3.14.0' },
      createdAt: '2026-11-01T12:00:00Z',
      updatedAt: '2026-11-01T12:00:00Z',
    };

    const result = validateProject(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('Entrypoint');
    }
  });
});

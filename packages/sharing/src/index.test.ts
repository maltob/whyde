import { describe, it, expect } from 'vitest';
import {
  exportProjectToUrlHash,
  importProjectFromUrlHash,
  MAX_URL_LENGTH,
} from './index.js';
import { Project } from '@ide/project-model';

describe('Compressed URL Sharing (Milestone 5 - IDE-013)', () => {
  const sampleProject: Project = {
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: 'original-local-id',
    name: 'Shared Python Calc',
    language: 'python',
    entrypoint: 'src/main.py',
    files: [
      {
        path: 'src/main.py',
        encoding: 'utf-8',
        content: 'def add(a, b): return a + b\nprint(add(2, 3))\n',
      },
    ],
    toolchain: { runtimeId: 'python-pyodide', requestedVersion: '314.0.7' },
    createdAt: '2026-11-01T12:00:00Z',
    updatedAt: '2026-11-01T12:00:00Z',
  };

  it('round-trips project export and import through compressed URL hash', () => {
    const exportResult = exportProjectToUrlHash(
      sampleProject,
      'https://example.edu/whyde/'
    );

    expect(exportResult.url).toContain('https://example.edu/whyde/?view=project#p=v1.');
    expect(exportResult.exceedsUrlLimit).toBe(false);
    expect(exportResult.byteLength).toBeLessThan(MAX_URL_LENGTH);

    const hash = exportResult.url.slice(exportResult.url.indexOf('#'));
    const importResult = importProjectFromUrlHash(hash);

    expect(importResult.success).toBe(true);
    expect(importResult.project).toBeDefined();
    if (importResult.project) {
      expect(importResult.project.name).toBe('Shared Python Calc');
      expect(importResult.project.language).toBe('python');
      expect(importResult.project.entrypoint).toBe('src/main.py');
      expect(importResult.project.files[0].content).toContain('def add(a, b)');
      // Local ID should be fresh on import, not overwriting existing
      expect(importResult.project.id).not.toBe('original-local-id');
    }
  });

  it('detects when large project exceeds conservative 8 KiB URL budget', () => {
    // Generate random non-repetitive content to prevent deflate high compression ratio
    let randomData = '';
    for (let i = 0; i < 20000; i++) {
      randomData += Math.random().toString(36).substring(2, 15);
    }
    const largeProject: Project = {
      ...sampleProject,
      files: [{ path: 'src/main.py', encoding: 'utf-8', content: randomData }],
    };

    const exportResult = exportProjectToUrlHash(
      largeProject,
      'https://example.edu/whyde/'
    );

    expect(exportResult.exceedsUrlLimit).toBe(true);
    expect(exportResult.byteLength).toBeGreaterThan(MAX_URL_LENGTH);
  });

  it('rejects malformed or tampered URL snapshot fragments', () => {
    const result = importProjectFromUrlHash('#p=v1.invalid_data_here');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IndexedDbProjectRepository } from './index.js';
import { AutoSaveManager } from './autosave.js';
import { Project } from '@ide/project-model';

describe('AutoSaveManager (IDE-006)', () => {
  let repo: IndexedDbProjectRepository;
  let autoSave: AutoSaveManager;

  const sampleProject: Project = {
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: 'proj-autosave',
    name: 'AutoSave Project',
    language: 'python',
    entrypoint: 'main.py',
    files: [{ path: 'main.py', encoding: 'utf-8', content: 'print(1)\n' }],
    toolchain: { runtimeId: 'python-pyodide', requestedVersion: '3.14.0' },
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  };

  beforeEach(() => {
    repo = new IndexedDbProjectRepository(`autosave-db-${Math.random()}`);
  });

  it('debounces and automatically saves modifications', async () => {
    const statuses: string[] = [];
    autoSave = new AutoSaveManager(repo, {
      debounceMs: 50,
      onStatusChange: (status) => statuses.push(status),
    });

    autoSave.scheduleSave(sampleProject);
    expect(statuses).toContain('saving');

    // Wait for debounce timer to fire
    await new Promise((r) => setTimeout(r, 80));

    expect(statuses).toContain('saved');
    expect(autoSave.getRevision()).toBe(1);

    const saved = await repo.get('proj-autosave');
    expect(saved).toBeDefined();
    expect(saved?.files[0].content).toBe('print(1)\n');
  });

  it('flush immediately saves pending changes', async () => {
    autoSave = new AutoSaveManager(repo, { debounceMs: 5000 });
    autoSave.scheduleSave(sampleProject);

    await autoSave.flush();
    expect(autoSave.getRevision()).toBe(1);

    const saved = await repo.get('proj-autosave');
    expect(saved).toBeDefined();
  });
});

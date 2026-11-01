import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDbProjectRepository } from './index.js';
import { Project } from '@ide/project-model';

describe('IndexedDbProjectRepository (IDE-006)', () => {
  let repo: IndexedDbProjectRepository;

  beforeEach(() => {
    // Unique DB name per test to ensure isolation
    const uniqueDbName = `test-db-${Math.random()}`;
    repo = new IndexedDbProjectRepository(uniqueDbName);
  });

  const sampleProject: Project = {
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: 'proj-1',
    name: 'Sample Project',
    language: 'python',
    entrypoint: 'src/main.py',
    files: [
      {
        path: 'src/main.py',
        encoding: 'utf-8',
        content: 'print("Hello from IndexedDB")\n',
      },
    ],
    toolchain: { runtimeId: 'python-pyodide', requestedVersion: '3.14.0' },
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  };

  it('saves and retrieves a valid project', async () => {
    const rev1 = await repo.save(sampleProject);
    expect(rev1).toBe(1);

    const loaded = await repo.get('proj-1');
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe('Sample Project');
    expect(loaded?.files[0].content).toContain('Hello from IndexedDB');
  });

  it('detects concurrent edit revision conflicts', async () => {
    const rev1 = await repo.save(sampleProject);
    expect(rev1).toBe(1);

    // Save with correct expectedRevision
    const rev2 = await repo.save(sampleProject, 1);
    expect(rev2).toBe(2);

    // Attempt save with stale revision
    await expect(repo.save(sampleProject, 1)).rejects.toThrow('Conflict: Expected revision 1 but found 2');
  });

  it('lists stored project summaries', async () => {
    await repo.save(sampleProject);
    const summaries = await repo.list();
    expect(summaries.length).toBe(1);
    expect(summaries[0].id).toBe('proj-1');
    expect(summaries[0].fileCount).toBe(1);
  });

  it('deletes stored projects cleanly', async () => {
    await repo.save(sampleProject);
    await repo.delete('proj-1');
    const loaded = await repo.get('proj-1');
    expect(loaded).toBeNull();
  });

  it('rejects saving invalid projects', async () => {
    const invalidProj: any = {
      ...sampleProject,
      files: [{ path: '../bad.py', encoding: 'utf-8', content: 'bad' }],
    };
    await expect(repo.save(invalidProj)).rejects.toThrow('Invalid project');
  });
});

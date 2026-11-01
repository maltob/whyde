import { openDB, type IDBPDatabase } from 'idb';
import { Project, validateProject } from '@ide/project-model';

export interface ProjectSummary {
  id: string;
  name: string;
  language: string;
  updatedAt: string;
  fileCount: number;
}

export interface StoredProjectRecord {
  project: Project;
  revision: number;
  lastSavedAt: string;
}

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<Project | null>;
  save(project: Project, expectedRevision?: number): Promise<number>;
  delete(id: string): Promise<void>;
  getRevision(id: string): Promise<number | null>;
}

const DB_NAME = 'browser-ide-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export class IndexedDbProjectRepository implements ProjectRepository {
  private dbPromise: Promise<IDBPDatabase>;

  constructor(customDbName = DB_NAME) {
    this.dbPromise = openDB(customDbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'project.id' });
          store.createIndex('updatedAt', 'project.updatedAt');
        }
      },
    });
  }

  async list(): Promise<ProjectSummary[]> {
    const db = await this.dbPromise;
    const records: StoredProjectRecord[] = await db.getAll(STORE_NAME);
    return records
      .map((r) => ({
        id: r.project.id,
        name: r.project.name,
        language: r.project.language,
        updatedAt: r.project.updatedAt,
        fileCount: r.project.files.length,
      }))
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  }

  async get(id: string): Promise<Project | null> {
    const db = await this.dbPromise;
    const record: StoredProjectRecord | undefined = await db.get(STORE_NAME, id);
    if (!record) return null;
    return record.project;
  }

  async getRevision(id: string): Promise<number | null> {
    const db = await this.dbPromise;
    const record: StoredProjectRecord | undefined = await db.get(STORE_NAME, id);
    return record ? record.revision : null;
  }

  async save(project: Project, expectedRevision?: number): Promise<number> {
    const validation = validateProject(project);
    if (!validation.success) {
      throw new Error(`Invalid project: ${validation.errors.join(', ')}`);
    }

    const db = await this.dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const existing: StoredProjectRecord | undefined = await store.get(project.id);
    const currentRev = existing ? existing.revision : 0;

    if (expectedRevision !== undefined && existing && currentRev !== expectedRevision) {
      throw new Error(
        `Conflict: Expected revision ${expectedRevision} but found ${currentRev}`
      );
    }

    const nextRevision = currentRev + 1;
    const updatedProject: Project = {
      ...project,
      updatedAt: new Date().toISOString(),
    };

    const record: StoredProjectRecord = {
      project: updatedProject,
      revision: nextRevision,
      lastSavedAt: new Date().toISOString(),
    };

    await store.put(record);
    await tx.done;

    return nextRevision;
  }

  async delete(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, id);
  }

  async close(): Promise<void> {
    const db = await this.dbPromise;
    db.close();
  }
}

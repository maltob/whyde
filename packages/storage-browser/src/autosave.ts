import { Project } from '@ide/project-model';
import { ProjectRepository } from './index.js';

export interface AutoSaveOptions {
  debounceMs?: number;
  onStatusChange?: (status: 'saved' | 'saving' | 'error', error?: string) => void;
}

export class AutoSaveManager {
  private repo: ProjectRepository;
  private debounceMs: number;
  private onStatusChange?: (status: 'saved' | 'saving' | 'error', error?: string) => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private currentRevision: number | undefined;
  private pendingProject: Project | null = null;

  constructor(repo: ProjectRepository, options: AutoSaveOptions = {}) {
    this.repo = repo;
    this.debounceMs = options.debounceMs ?? 500;
    this.onStatusChange = options.onStatusChange;
  }

  public setInitialRevision(rev: number) {
    this.currentRevision = rev;
  }

  public getRevision(): number | undefined {
    return this.currentRevision;
  }

  public scheduleSave(project: Project) {
    this.pendingProject = project;
    this.onStatusChange?.('saving');

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(async () => {
      await this.flush();
    }, this.debounceMs);
  }

  public async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.pendingProject) return;

    const projectToSave = this.pendingProject;
    this.pendingProject = null;

    try {
      const nextRev = await this.repo.save(projectToSave, this.currentRevision);
      this.currentRevision = nextRev;
      this.onStatusChange?.('saved');
    } catch (err: any) {
      this.onStatusChange?.('error', err?.message || 'Failed to save');
      throw err;
    }
  }

  public dispose() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

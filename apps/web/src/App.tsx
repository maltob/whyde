import React, { useState, useEffect, useRef } from 'react';
import { Project } from '@ide/project-model';
import { IndexedDbProjectRepository } from '@ide/storage-browser';
import { AutoSaveManager } from '@ide/storage-browser/autosave';
import { Header } from './Header.js';
import { FileTree } from './FileTree.js';
import { Editor } from './Editor.js';
import { Terminal } from './Terminal.js';
import { STARTER_PROJECTS } from './templates.js';
import { executeClientSideCode } from './clientExecutor.js';

const repo = new IndexedDbProjectRepository();

export const App: React.FC = () => {
  const [project, setProject] = useState<Project>(() => STARTER_PROJECTS.python());
  const [activeFilePath, setActiveFilePath] = useState<string>('src/main.py');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<{ type: 'stdout' | 'stderr' | 'info'; text: string }[]>([]);
  const [pendingStdin, setPendingStdin] = useState<{ requestId: string; prompt?: string } | null>(null);

  const autoSaveRef = useRef<AutoSaveManager | null>(null);

  // Initialize storage repository & load last project or fallback to starter
  useEffect(() => {
    const autoSave = new AutoSaveManager(repo, {
      debounceMs: 500,
      onStatusChange: (status: 'saved' | 'saving' | 'error') => setSaveStatus(status),
    });
    autoSaveRef.current = autoSave;

    repo.list().then(async (list) => {
      if (list.length > 0) {
        const existing = await repo.get(list[0].id);
        if (existing) {
          setProject(existing);
          setActiveFilePath(existing.entrypoint);
          const rev = await repo.getRevision(existing.id);
          if (rev) autoSave.setInitialRevision(rev);
          return;
        }
      }
      // Save initial project
      const initial = STARTER_PROJECTS.python();
      setProject(initial);
      setActiveFilePath(initial.entrypoint);
      const rev = await repo.save(initial);
      autoSave.setInitialRevision(rev);
    });

    return () => {
      autoSave.dispose();
    };
  }, []);

  const activeFile = project.files.find((f) => f.path === activeFilePath) || project.files[0];

  const handleContentChange = (newContent: string) => {
    const updatedFiles = project.files.map((f) =>
      f.path === activeFile.path ? { ...f, content: newContent } : f
    );
    const updatedProj: Project = {
      ...project,
      files: updatedFiles,
      updatedAt: new Date().toISOString(),
    };
    setProject(updatedProj);
    autoSaveRef.current?.scheduleSave(updatedProj);
  };

  const handleAddFile = (path: string) => {
    if (project.files.some((f) => f.path === path)) return;
    const updatedFiles = [...project.files, { path, encoding: 'utf-8' as const, content: '' }];
    const updatedProj = { ...project, files: updatedFiles, updatedAt: new Date().toISOString() };
    setProject(updatedProj);
    setActiveFilePath(path);
    autoSaveRef.current?.scheduleSave(updatedProj);
  };

  const handleDeleteFile = (path: string) => {
    if (project.files.length <= 1) return;
    const updatedFiles = project.files.filter((f) => f.path !== path);
    const updatedProj = { ...project, files: updatedFiles, updatedAt: new Date().toISOString() };
    setProject(updatedProj);
    if (activeFilePath === path) {
      setActiveFilePath(updatedFiles[0].path);
    }
    autoSaveRef.current?.scheduleSave(updatedProj);
  };

  const handleNewProject = async (lang: 'python' | 'java' | 'cpp') => {
    const newProj = STARTER_PROJECTS[lang]();
    setProject(newProj);
    setActiveFilePath(newProj.entrypoint);
    setLogs([]);
    setPendingStdin(null);
    setIsRunning(false);
    const rev = await repo.save(newProj);
    autoSaveRef.current?.setInitialRevision(rev);
  };

  const handleRun = () => {
    setIsRunning(true);
    setLogs((prev) => [
      ...prev,
      { type: 'info', text: `[Browser IDE] Compiling and running ${project.language} (${activeFile.path})...\n` },
    ]);

    setTimeout(() => {
      const result = executeClientSideCode(project.language, activeFile.content);

      if (result.stderr) {
        setLogs((prev) => [...prev, { type: 'stderr', text: result.stderr }]);
        setIsRunning(false);
        return;
      }

      if (result.stdout) {
        setLogs((prev) => [...prev, { type: 'stdout', text: result.stdout }]);
      }

      if (result.requiresStdin) {
        setPendingStdin({
          requestId: result.requiresStdin.requestId,
          prompt: result.requiresStdin.prompt,
        });
      } else {
        setLogs((prev) => [
          ...prev,
          { type: 'info', text: `[Browser IDE] Program completed with exit code ${result.exitCode}.\n` },
        ]);
        setIsRunning(false);
      }
    }, 200);
  };

  const handleSupplyStdin = (requestId: string, input: string) => {
    setLogs((prev) => [
      ...prev,
      { type: 'stdout', text: `${input}\n` },
    ]);

    // Resume execution with the supplied input
    const result = executeClientSideCode(project.language, activeFile.content, input);
    if (result.stdout) {
      setLogs((prev) => [...prev, { type: 'stdout', text: result.stdout }]);
    }
    if (result.stderr) {
      setLogs((prev) => [...prev, { type: 'stderr', text: result.stderr }]);
    }
    setLogs((prev) => [
      ...prev,
      { type: 'info', text: `[Browser IDE] Program completed with exit code ${result.exitCode}.\n` },
    ]);
    setPendingStdin(null);
    setIsRunning(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    setPendingStdin(null);
    setLogs((prev) => [
      ...prev,
      { type: 'stderr', text: `[Browser IDE] Execution cancelled by user.\n` },
    ]);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#020617',
      }}
    >
      <Header
        project={project}
        saveStatus={saveStatus}
        isRunning={isRunning}
        onRun={handleRun}
        onStop={handleStop}
        onNewProject={handleNewProject}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <FileTree
          files={project.files}
          activeFile={activeFile.path}
          onSelectFile={(path) => setActiveFilePath(path)}
          onAddFile={handleAddFile}
          onDeleteFile={handleDeleteFile}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <Editor
            filePath={activeFile.path}
            content={activeFile.content}
            onChange={handleContentChange}
          />
          <Terminal
            logs={logs}
            pendingStdin={pendingStdin}
            onSupplyStdin={handleSupplyStdin}
            onClear={() => setLogs([])}
          />
        </div>
      </div>
    </div>
  );
};

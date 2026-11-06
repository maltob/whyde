import React, { useState, useEffect, useRef } from 'react';
import { Project } from '@ide/project-model';
import { IndexedDbProjectRepository } from '@ide/storage-browser';
import { AutoSaveManager } from '@ide/storage-browser/autosave';
import { Header } from './Header.js';
import { FileTree } from './FileTree.js';
import { Editor } from './Editor.js';
import { XtermTerminal } from './XtermTerminal.js';
import { STARTER_PROJECTS, BLANK_PROJECTS } from './templates.js';
import { executeClientSideCode } from './clientExecutor.js';
import { executePythonInPyodide } from '@ide/runner-python';
import { compileAndRunCpp } from '@ide/runner-cpp';
import { compileAndRunJava } from '@ide/runner-java';
import { parseUrlHash, setUrlHash } from './hashParams.js';
import { yieldToMainThread } from './yieldHelper.js';
import { exportProjectToUrlHash, importProjectFromUrlHash } from '@ide/sharing';

const repo = new IndexedDbProjectRepository();

export const App: React.FC = () => {
  const initialHash = useRef(parseUrlHash()).current;
  const [project, setProject] = useState<Project>(() => {
    if (initialHash.lang) {
      if (initialHash.blank && BLANK_PROJECTS[initialHash.lang]) {
        return BLANK_PROJECTS[initialHash.lang]();
      }
      if (STARTER_PROJECTS[initialHash.lang]) {
        return STARTER_PROJECTS[initialHash.lang]();
      }
    }
    return initialHash.blank ? BLANK_PROJECTS.python() : STARTER_PROJECTS.python();
  });
  const [activeFilePath, setActiveFilePath] = useState<string>(() => {
    return initialHash.file || (initialHash.lang ? STARTER_PROJECTS[initialHash.lang]().entrypoint : 'src/main.py');
  });
  const [syntaxColoring, setSyntaxColoring] = useState<boolean>(() => {
    return initialHash.highlight !== undefined ? initialHash.highlight : true;
  });
  const [codeSuggest, setCodeSuggest] = useState<boolean>(() => {
    return initialHash.codeSuggest !== undefined ? initialHash.codeSuggest : true;
  });
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [executionPhase, setExecutionPhase] = useState<'idle' | 'compiling' | 'running'>('idle');
  const [terminalHeight, setTerminalHeight] = useState<number>(240);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState<boolean>(false);
  const [activeCenterTab, setActiveCenterTab] = useState<'editor' | 'terminal'>('editor');
  const isDraggingSplitterRef = useRef<boolean>(false);

  const [logs, setLogs] = useState<{ type: 'stdout' | 'stderr' | 'info'; text: string }[]>([]);
  const [plots, setPlots] = useState<string[]>([]);
  const [pendingStdin, setPendingStdin] = useState<{ requestId: string; prompt?: string } | null>(null);
  const [suppliedInputs, setSuppliedInputs] = useState<string[]>([]);
  const lastOutputLengthRef = useRef<number>(0);
  const compiledWasmRef = useRef<Uint8Array | null>(null);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplitterRef.current = true;
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSplitterRef.current) return;
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(80, Math.min(window.innerHeight - 150, startHeight - deltaY));
      setTerminalHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDraggingSplitterRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const autoSaveRef = useRef<AutoSaveManager | null>(null);

  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [shareRawSnapshotHash, setShareRawSnapshotHash] = useState<string>('');
  const [shareOptionHideNew, setShareOptionHideNew] = useState<boolean>(false);
  const [shareOptionHighlight, setShareOptionHighlight] = useState<boolean>(true);
  const [shareOptionSuggest, setShareOptionSuggest] = useState<boolean>(true);
  const [shareOptionFile, setShareOptionFile] = useState<string>('');
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  // Initialize storage repository & load last project or fallback to starter
  useEffect(() => {
    const autoSave = new AutoSaveManager(repo, {
      debounceMs: 500,
      onStatusChange: (status: 'saved' | 'saving' | 'error') => setSaveStatus(status),
    });
    autoSaveRef.current = autoSave;

    repo.list().then(async (list) => {
      // Check if URL has a snapshot hash (#p=v1.<payload>)
      if (typeof window !== 'undefined' && window.location.hash.includes('#p=v1.')) {
        const importRes = importProjectFromUrlHash(window.location.hash);
        if (importRes.success && importRes.project) {
          setProject(importRes.project);
          setActiveFilePath(importRes.project.entrypoint);
          const rev = await repo.save(importRes.project);
          autoSave.setInitialRevision(rev);
          return;
        }
      }

      // If user provided a specific language/blank via URL hash, prioritize it
      if (initialHash.lang || initialHash.blank) {
        const lang = initialHash.lang || 'python';
        const hashProj = initialHash.blank ? BLANK_PROJECTS[lang]() : STARTER_PROJECTS[lang]();
        setProject(hashProj);
        setActiveFilePath(initialHash.file || hashProj.entrypoint);
        const rev = await repo.save(hashProj);
        autoSave.setInitialRevision(rev);
        return;
      }

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
    const cleanPath = path.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
    const isFolder = !project.files.some((f) => f.path === cleanPath);
    let updatedFiles: typeof project.files;
    if (isFolder) {
      updatedFiles = project.files.filter((f) => !f.path.startsWith(cleanPath + '/'));
    } else {
      updatedFiles = project.files.filter((f) => f.path !== cleanPath);
    }
    if (updatedFiles.length === 0) return;
    const updatedProj = { ...project, files: updatedFiles, updatedAt: new Date().toISOString() };
    setProject(updatedProj);
    if (!updatedFiles.some((f) => f.path === activeFilePath)) {
      setActiveFilePath(updatedFiles[0].path);
    }
    autoSaveRef.current?.scheduleSave(updatedProj);
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    const cleanOld = oldPath.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
    const cleanNew = newPath.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
    if (!cleanNew || cleanOld === cleanNew) return;

    if (project.files.some((f) => f.path === cleanNew)) {
      alert(`A file with name "${cleanNew}" already exists.`);
      return;
    }

    let activePathUpdated = activeFilePath;
    const updatedFiles = project.files.map((f) => {
      if (f.path === cleanOld) {
        if (activeFilePath === cleanOld) {
          activePathUpdated = cleanNew;
        }
        return { ...f, path: cleanNew };
      }
      if (f.path.startsWith(cleanOld + '/')) {
        const subPath = f.path.slice(cleanOld.length);
        const renamedSubPath = cleanNew + subPath;
        if (activeFilePath === f.path) {
          activePathUpdated = renamedSubPath;
        }
        return { ...f, path: renamedSubPath };
      }
      return f;
    });

    const updatedProj = { ...project, files: updatedFiles, updatedAt: new Date().toISOString() };
    setProject(updatedProj);
    if (activePathUpdated !== activeFilePath) {
      setActiveFilePath(activePathUpdated);
      setUrlHash({
        lang: project.language,
        file: activePathUpdated,
        highlight: syntaxColoring,
      });
    }
    autoSaveRef.current?.scheduleSave(updatedProj);
  };

  const handleMoveFile = (sourcePath: string, targetDirPath: string) => {
    const cleanSource = sourcePath.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
    const cleanTargetDir = targetDirPath.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');

    if (cleanTargetDir === cleanSource || cleanTargetDir.startsWith(cleanSource + '/')) {
      return;
    }

    const fileName = cleanSource.split(/[/\\]+/).pop() || cleanSource;
    const finalNewPath = cleanTargetDir ? `${cleanTargetDir}/${fileName}` : fileName;
    if (finalNewPath === cleanSource) return;

    handleRenameFile(cleanSource, finalNewPath);
  };

  const handleDuplicateFile = (path: string) => {
    const file = project.files.find((f) => f.path === path);
    if (!file) return;

    const extMatch = path.match(/\.([^.]+)$/);
    const ext = extMatch ? `.${extMatch[1]}` : '';
    const base = extMatch ? path.slice(0, -ext.length) : path;

    let copyPath = `${base}_copy${ext}`;
    let counter = 1;
    while (project.files.some((f) => f.path === copyPath)) {
      counter++;
      copyPath = `${base}_copy${counter}${ext}`;
    }

    const updatedFiles = [...project.files, { path: copyPath, encoding: 'utf-8' as const, content: file.content }];
    const updatedProj = { ...project, files: updatedFiles, updatedAt: new Date().toISOString() };
    setProject(updatedProj);
    setActiveFilePath(copyPath);
    autoSaveRef.current?.scheduleSave(updatedProj);
  };

  const handleUploadFiles = (uploaded: { path: string; content: string }[]) => {
    if (uploaded.length === 0) return;
    let newFiles = [...project.files];
    let lastPath = activeFilePath;

    for (const item of uploaded) {
      const existingIdx = newFiles.findIndex((f) => f.path === item.path);
      if (existingIdx >= 0) {
        newFiles[existingIdx] = { path: item.path, encoding: 'utf-8', content: item.content };
      } else {
        newFiles.push({ path: item.path, encoding: 'utf-8', content: item.content });
      }
      lastPath = item.path;
    }

    const updatedProj: Project = {
      ...project,
      files: newFiles,
      updatedAt: new Date().toISOString(),
    };
    setProject(updatedProj);
    setActiveFilePath(lastPath);
    autoSaveRef.current?.scheduleSave(updatedProj);
  };

  const handleShareClick = () => {
    const origin = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    const { url } = exportProjectToUrlHash(project, origin);
    // Extract fragment after '#p=v1.'
    const match = url.match(/#p=v1\.([A-Za-z0-9_-]+)/);
    setShareRawSnapshotHash(match ? match[1] : '');
    setShareOptionHideNew(false);
    setShareOptionHighlight(syntaxColoring);
    setShareOptionSuggest(codeSuggest);
    setShareOptionFile(activeFilePath);
    setShareModalOpen(true);
    setCopiedShare(false);
  };

  const handleNewProject = async (lang: 'python' | 'java' | 'cpp' | 'javascript', blank: boolean = false) => {
    const newProj = blank ? BLANK_PROJECTS[lang]() : STARTER_PROJECTS[lang]();
    setProject(newProj);
    setActiveFilePath(newProj.entrypoint);
    setLogs([]);
    setPendingStdin(null);
    setSuppliedInputs([]);
    setIsRunning(false);
    setUrlHash({
      lang,
      blank: blank ? true : undefined,
      file: newProj.entrypoint,
      highlight: syntaxColoring,
    });
    const rev = await repo.save(newProj);
    autoSaveRef.current?.setInitialRevision(rev);
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setExecutionPhase(project.language === 'cpp' ? 'compiling' : 'running');
    setSuppliedInputs([]);
    lastOutputLengthRef.current = 0;
    setLogs((prev) => [
      ...prev,
      { type: 'info', text: `[Browser IDE] Compiling and running ${project.language} (${activeFile.path})...\n` },
    ]);

    // Yield to the browser event loop so React flushes DOM updates and paints the animated "Compiling..." button
    // before CPU-bound WebAssembly execution starts on the main thread.
    await yieldToMainThread();

    if (project.language === 'python') {
      const localPyodideUrl = typeof window !== 'undefined'
        ? (window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/') + 'pyodide/')
        : undefined;
      executePythonInPyodide(project, {
        indexURL: localPyodideUrl,
        stdin: undefined,
        onStdout: (text) => {
          setLogs((prev) => [...prev, { type: 'stdout', text }]);
        },
        onStderr: (text) => {
          setLogs((prev) => [...prev, { type: 'stderr', text }]);
        },
        onPlot: (dataUrl) => {
          setPlots((prev) => [...prev, dataUrl]);
        },
        requestStdin: async (prompt) => {
          return new Promise<string>((resolve) => {
            const reqId = `py-stdin-${Date.now()}`;
            (window as any).__pyodide_stdin_resolver = resolve;
            setPendingStdin({
              requestId: reqId,
              prompt: prompt || 'Enter input: ',
            });
          });
        },
      }).then(
        (res) => {
          setLogs((prev) => [
            ...prev,
            { type: 'info', text: `[Browser IDE] Program completed with exit code ${res.exitCode}.\n` },
          ]);
          setIsRunning(false);
        },
        (err) => {
          setLogs((prev) => [...prev, { type: 'stderr', text: `[Browser IDE Error] ${err?.message || err}\n` }]);
          setIsRunning(false);
        }
      );
      return;
    }

    if (project.language === 'cpp') {
      compiledWasmRef.current = null;
      const filesMap: Record<string, string> = {};
      for (const f of project.files) {
        filesMap[f.path] = f.content;
      }

      let runOutput = '';
      compileAndRunCpp({
        files: filesMap,
        standard: 'c++17',
        stdin: undefined,
        onInfo: (text) => {
          if (text.includes('Executing WASI binary') || text.includes('Using cached')) {
            setExecutionPhase('running');
          }
          setLogs((prev) => [...prev, { type: 'info', text }]);
        },
        onStdout: (text) => {
          runOutput += text;
          lastOutputLengthRef.current += text.length;
          setLogs((prev) => [...prev, { type: 'stdout', text }]);
        },
        onStderr: (text) => {
          setLogs((prev) => [...prev, { type: 'stderr', text }]);
        },
        onEvent: (event) => {
          if (event.type === 'stdin-request') {
            setPendingStdin({
              requestId: event.requestId,
              prompt: event.prompt || 'Enter input: ',
            });
          }
        },
      }).then(
        (res) => {
          if (res.compiledWasm) {
            compiledWasmRef.current = res.compiledWasm;
          }
          if (res.requiresStdin) {
            setPendingStdin({
              requestId: res.requiresStdin.requestId,
              prompt: res.requiresStdin.prompt || 'Enter input: ',
            });
          } else {
            setLogs((prev) => [
              ...prev,
              { type: 'info', text: `[Browser IDE] Program completed with exit code ${res.exitCode}.\n` },
            ]);
            setPendingStdin(null);
            setExecutionPhase('idle');
            setIsRunning(false);
          }
        },
        (err) => {
          setLogs((prev) => [...prev, { type: 'stderr', text: `[Browser IDE Error] ${err?.message || err}\n` }]);
          setExecutionPhase('idle');
          setIsRunning(false);
        }
      );
      return;
    }

    if (project.language === 'java') {
      compileAndRunJava(project, {
        stdin: undefined,
        onStdout: (text) => {
          lastOutputLengthRef.current += text.length;
          setLogs((prev) => [...prev, { type: 'stdout', text }]);
        },
        onStderr: (text) => {
          setLogs((prev) => [...prev, { type: 'stderr', text }]);
        },
        onEvent: (event) => {
          if (event.type === 'stdin-request') {
            setPendingStdin({
              requestId: event.requestId,
              prompt: event.prompt || 'Enter input: ',
            });
          }
        },
      }).then(
        (res) => {
          if (res.requiresStdin) {
            setPendingStdin({
              requestId: res.requiresStdin.requestId,
              prompt: res.requiresStdin.prompt || 'Enter input: ',
            });
          } else {
            setLogs((prev) => [
              ...prev,
              { type: 'info', text: `[Browser IDE] Program completed with exit code ${res.exitCode}.\n` },
            ]);
            setIsRunning(false);
          }
        },
        (err) => {
          setLogs((prev) => [...prev, { type: 'stderr', text: `[Browser IDE Error] ${err?.message || err}\n` }]);
          setIsRunning(false);
        }
      );
      return;
    }

    setTimeout(() => {
      const result = executeClientSideCode(
        project.language,
        activeFile.content,
        undefined,
        project.files
      );

      if (result.stderr) {
        setLogs((prev) => [...prev, { type: 'stderr', text: result.stderr }]);
        setIsRunning(false);
        return;
      }

      if (result.stdout) {
        const fullOutput = result.stdout;
        const newSegment = fullOutput.slice(lastOutputLengthRef.current);
        lastOutputLengthRef.current = fullOutput.length;
        if (newSegment) {
          setLogs((prev) => [...prev, { type: 'stdout', text: newSegment }]);
        }
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
    const nextInputs = [...suppliedInputs, input];
    setSuppliedInputs(nextInputs);

    if (project.language === 'python' && (window as any).__pyodide_stdin_resolver) {
      const resolver = (window as any).__pyodide_stdin_resolver;
      (window as any).__pyodide_stdin_resolver = null;
      setPendingStdin(null);
      setLogs((prev) => [...prev, { type: 'stdout', text: input + '\n' }]);
      resolver(input);
      return;
    }

    if (project.language === 'cpp') {
      const filesMap: Record<string, string> = {};
      for (const f of project.files) {
        filesMap[f.path] = f.content;
      }

      let runOutput = '';
      compileAndRunCpp({
        files: filesMap,
        standard: 'c++17',
        stdin: nextInputs.join('\n'),
        compiledWasm: compiledWasmRef.current || undefined,
        onStdout: (text) => {
          runOutput += text;
        },
        onStderr: (text) => {
          setLogs((prev) => [...prev, { type: 'stderr', text }]);
        },
        onEvent: (event) => {
          if (event.type === 'stdin-request') {
            setPendingStdin({
              requestId: event.requestId,
              prompt: event.prompt || 'Enter input: ',
            });
          }
        },
      }).then(
        (res) => {
          if (res.compiledWasm) {
            compiledWasmRef.current = res.compiledWasm;
          }
          const newSegment = runOutput.slice(lastOutputLengthRef.current);
          lastOutputLengthRef.current = runOutput.length;
          if (newSegment) {
            setLogs((prev) => [...prev, { type: 'stdout', text: newSegment }]);
          }

          if (res.requiresStdin) {
            setPendingStdin({
              requestId: res.requiresStdin.requestId,
              prompt: res.requiresStdin.prompt || 'Enter input: ',
            });
          } else {
            setLogs((prev) => [
              ...prev,
              { type: 'info', text: `[Browser IDE] Program completed with exit code ${res.exitCode}.\n` },
            ]);
            setPendingStdin(null);
            setExecutionPhase('idle');
            setIsRunning(false);
          }
        },
        (err) => {
          setLogs((prev) => [...prev, { type: 'stderr', text: `[Browser IDE Error] ${err?.message || err}\n` }]);
          setExecutionPhase('idle');
          setIsRunning(false);
        }
      );
      return;
    }

    if (project.language === 'java') {
      let runOutput = '';
      compileAndRunJava(project, {
        stdin: nextInputs.join('\n'),
        onStdout: (text) => {
          runOutput += text;
        },
        onStderr: (text) => {
          setLogs((prev) => [...prev, { type: 'stderr', text }]);
        },
        onEvent: (event) => {
          if (event.type === 'stdin-request') {
            setPendingStdin({
              requestId: event.requestId,
              prompt: event.prompt || 'Enter input: ',
            });
          }
        },
      }).then(
        (res) => {
          const newSegment = runOutput.slice(lastOutputLengthRef.current);
          lastOutputLengthRef.current = runOutput.length;
          if (newSegment) {
            setLogs((prev) => [...prev, { type: 'stdout', text: newSegment }]);
          }

          if (res.requiresStdin) {
            setPendingStdin({
              requestId: res.requiresStdin.requestId,
              prompt: res.requiresStdin.prompt || 'Enter input: ',
            });
          } else {
            setLogs((prev) => [
              ...prev,
              { type: 'info', text: `[Browser IDE] Program completed with exit code ${res.exitCode}.\n` },
            ]);
            setPendingStdin(null);
            setExecutionPhase('idle');
            setIsRunning(false);
          }
        },
        (err) => {
          setLogs((prev) => [...prev, { type: 'stderr', text: `[Browser IDE Error] ${err?.message || err}\n` }]);
          setExecutionPhase('idle');
          setIsRunning(false);
        }
      );
      return;
    }

    // Resume execution with the supplied inputs
    const result = executeClientSideCode(
      project.language,
      activeFile.content,
      nextInputs,
      project.files
    );
    if (result.stdout) {
      const fullOutput = result.stdout;
      const newSegment = fullOutput.slice(lastOutputLengthRef.current);
      lastOutputLengthRef.current = fullOutput.length;
      if (newSegment) {
        setLogs((prev) => [...prev, { type: 'stdout', text: newSegment }]);
      }
    }
    if (result.stderr) {
      setLogs((prev) => [...prev, { type: 'stderr', text: result.stderr }]);
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
      setPendingStdin(null);
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    setExecutionPhase('idle');
    setPendingStdin(null);
    setLogs((prev) => [
      ...prev,
      { type: 'stderr', text: `[Browser IDE] Execution cancelled by user.\n` },
    ]);
  };

  const handleToggleSyntaxColoring = (enabled: boolean) => {
    setSyntaxColoring(enabled);
    setUrlHash({
      lang: project.language,
      file: activeFilePath,
      highlight: enabled,
    });
  };

  const handleSelectFile = (path: string) => {
    setActiveFilePath(path);
    setUrlHash({
      lang: project.language,
      file: path,
      highlight: syntaxColoring,
    });
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
        executionPhase={executionPhase}
        hideNewProject={initialHash.hideNewProject}
        onRun={handleRun}
        onStop={handleStop}
        onNewProject={handleNewProject}
        onShare={handleShareClick}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <FileTree
          files={project.files}
          activeFile={activeFile.path}
          onSelectFile={(path) => {
            handleSelectFile(path);
            setActiveCenterTab('editor');
            setIsTerminalMaximized(false);
          }}
          onAddFile={handleAddFile}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
          onMoveFile={handleMoveFile}
          onDuplicateFile={handleDuplicateFile}
          onUploadFiles={handleUploadFiles}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Main Workspace Top Tabs (Editor / Terminal) */}
          {(() => {
            const isTerminalActive = activeCenterTab === 'terminal' || isTerminalMaximized;
            return (
              <>
                <div
                  style={{
                    display: 'flex',
                    backgroundColor: '#090d16',
                    borderBottom: '1px solid #1e293b',
                    paddingLeft: '6px',
                  }}
                >
                  <button
                    onClick={() => {
                      setActiveCenterTab('editor');
                      setIsTerminalMaximized(false);
                    }}
                    style={{
                      padding: '6px 14px',
                      backgroundColor: !isTerminalActive ? '#1e293b' : 'transparent',
                      color: !isTerminalActive ? '#38bdf8' : '#94a3b8',
                      border: 'none',
                      borderBottom: !isTerminalActive ? '2px solid #38bdf8' : '2px solid transparent',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>{activeFile.path.split('/').pop()}</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveCenterTab('terminal');
                      setIsTerminalMaximized(true);
                    }}
                    style={{
                      padding: '6px 14px',
                      backgroundColor: isTerminalActive ? '#1e293b' : 'transparent',
                      color: isTerminalActive ? '#38bdf8' : '#94a3b8',
                      border: 'none',
                      borderBottom: isTerminalActive ? '2px solid #38bdf8' : '2px solid transparent',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Terminal Tab</span>
                  </button>
                </div>

                {!isTerminalActive && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Editor
                      filePath={activeFile.path}
                      content={activeFile.content}
                      syntaxColoring={syntaxColoring}
                      onToggleSyntaxColoring={handleToggleSyntaxColoring}
                      showColoringButton={initialHash.highlight !== false}
                      codeSuggest={codeSuggest}
                      onToggleCodeSuggest={(enabled) => {
                        setCodeSuggest(enabled);
                        setUrlHash({
                          lang: project.language as any,
                          highlight: syntaxColoring,
                          codeSuggest: enabled,
                          file: activeFilePath,
                        });
                      }}
                      showSuggestButton={initialHash.codeSuggest !== false}
                      allFilePaths={project.files.map((f) => f.path)}
                      allFiles={project.files.map((f) => ({ path: f.path, content: f.content }))}
                      onChange={handleContentChange}
                    />
                  </div>
                )}

                {/* Draggable Splitter between Editor and Terminal */}
                {!isTerminalActive && (
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    title="Drag up or down to resize terminal"
                    onMouseDown={handleSplitterMouseDown}
                    style={{
                      height: '4px',
                      backgroundColor: '#1e293b',
                      cursor: 'row-resize',
                      transition: 'background-color 0.15s ease',
                      userSelect: 'none',
                      zIndex: 10,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#38bdf8')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
                  />
                )}

                <div
                  style={{
                    height: isTerminalActive ? '100%' : `${terminalHeight}px`,
                    display: !isTerminalActive && terminalHeight === 0 ? 'none' : 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flex: isTerminalActive ? 1 : undefined,
                  }}
                >
                  <XtermTerminal
                    logs={logs}
                    plots={plots}
                    pendingStdin={pendingStdin}
                    onSupplyStdin={handleSupplyStdin}
                    onClear={() => {
                      setLogs([]);
                      setPlots([]);
                    }}
                    height="100%"
                    isMaximized={isTerminalActive}
                    onToggleMaximize={() => {
                      if (isTerminalActive) {
                        setActiveCenterTab('editor');
                        setIsTerminalMaximized(false);
                      } else {
                        setActiveCenterTab('terminal');
                        setIsTerminalMaximized(true);
                      }
                    }}
                  />
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Share Snapshot Modal */}
      {shareModalOpen && (() => {
        const origin = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
        const params = new URLSearchParams();
        if (shareRawSnapshotHash) {
          // Put p parameter
          params.set('p', `v1.${shareRawSnapshotHash}`);
        }
        if (shareOptionHideNew) {
          params.set('hideNewProject', 'true');
        }
        if (!shareOptionHighlight) {
          params.set('highlight', 'off');
        }
        if (!shareOptionSuggest) {
          params.set('codeSuggest', '0');
        }
        if (shareOptionFile && shareOptionFile !== project.entrypoint) {
          params.set('file', shareOptionFile);
        }

        const shareUrl = `${origin}?view=project#${params.toString()}`;
        const exceedsLimit = shareUrl.length > 8192;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
            onClick={() => setShareModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '16px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                maxWidth: '600px',
                width: '100%',
                padding: '20px',
                color: '#f8fafc',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 id="share-dialog-title" style={{ fontSize: '1.1rem', fontWeight: 600, color: '#38bdf8', margin: 0 }}>
                  Share Project & Configure Link
                </h2>
                <button
                  onClick={() => setShareModalOpen(false)}
                  aria-label="Close"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '16px', lineHeight: 1.5 }}>
                Configure environment options for your students or embed, then copy the portable snapshot URL.
              </p>

              {/* URL Options & Toggles */}
              <div
                style={{
                  backgroundColor: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                  STUDENT ENVIRONMENT OPTIONS
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={shareOptionHideNew}
                    onChange={(e) => setShareOptionHideNew(e.target.checked)}
                    style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                  <span>
                    <strong>Lock Project:</strong> Hide "+ New Project" button (keep student focused on this lab)
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!shareOptionSuggest}
                    onChange={(e) => setShareOptionSuggest(!e.target.checked)}
                    style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                  <span>
                    <strong>Exam Mode (Suggestions):</strong> Disable autocomplete & standard library suggestions
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!shareOptionHighlight}
                    onChange={(e) => setShareOptionHighlight(!e.target.checked)}
                    style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                  <span>
                    <strong>Exam Mode (Coloring):</strong> Disable editor syntax highlighting
                  </span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                  <label htmlFor="share-initial-file" style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>
                    Initial Active File:
                  </label>
                  <select
                    id="share-initial-file"
                    value={shareOptionFile}
                    onChange={(e) => setShareOptionFile(e.target.value)}
                    style={{
                      backgroundColor: '#1e293b',
                      color: '#f8fafc',
                      border: '1px solid #475569',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    {project.files.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.path}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {exceedsLimit && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    color: '#fca5a5',
                    marginBottom: '12px',
                  }}
                >
                  ⚠️ URL length ({shareUrl.length} bytes) exceeds the 8 KiB browser limit.
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    backgroundColor: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    color: '#e2e8f0',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    setCopiedShare(true);
                    setTimeout(() => setCopiedShare(false), 2500);
                  }}
                  style={{
                    backgroundColor: copiedShare ? '#16a34a' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {copiedShare ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShareModalOpen(false)}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#cbd5e1',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    padding: '6px 16px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

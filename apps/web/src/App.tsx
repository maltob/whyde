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
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<{ type: 'stdout' | 'stderr' | 'info'; text: string }[]>([]);
  const [pendingStdin, setPendingStdin] = useState<{ requestId: string; prompt?: string } | null>(null);
  const [suppliedInputs, setSuppliedInputs] = useState<string[]>([]);
  const lastOutputLengthRef = useRef<number>(0);
  const compiledWasmRef = useRef<Uint8Array | null>(null);

  const autoSaveRef = useRef<AutoSaveManager | null>(null);

  // Initialize storage repository & load last project or fallback to starter
  useEffect(() => {
    const autoSave = new AutoSaveManager(repo, {
      debounceMs: 500,
      onStatusChange: (status: 'saved' | 'saving' | 'error') => setSaveStatus(status),
    });
    autoSaveRef.current = autoSave;

    repo.list().then(async (list) => {
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
    if (project.files.length <= 1) return;
    const updatedFiles = project.files.filter((f) => f.path !== path);
    const updatedProj = { ...project, files: updatedFiles, updatedAt: new Date().toISOString() };
    setProject(updatedProj);
    if (activeFilePath === path) {
      setActiveFilePath(updatedFiles[0].path);
    }
    autoSaveRef.current?.scheduleSave(updatedProj);
  };

  const handleNewProject = async (lang: 'python' | 'java' | 'cpp', blank: boolean = false) => {
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

  const handleRun = () => {
    setIsRunning(true);
    setSuppliedInputs([]);
    lastOutputLengthRef.current = 0;
    setLogs((prev) => [
      ...prev,
      { type: 'info', text: `[Browser IDE] Compiling and running ${project.language} (${activeFile.path})...\n` },
    ]);

    if (project.language === 'python') {
      executePythonInPyodide(project, {
        indexURL: typeof window !== 'undefined' ? (window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/') + 'pyodide/') : undefined,
        stdin: suppliedInputs.length > 0 ? suppliedInputs.join('\n') : undefined,
        onStdout: (text) => {
          setLogs((prev) => [...prev, { type: 'stdout', text }]);
        },
        onStderr: (text) => {
          setLogs((prev) => [...prev, { type: 'stderr', text }]);
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
        stdin: suppliedInputs.length > 0 ? suppliedInputs.join('\n') : undefined,
        onInfo: (text) => {
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

    if (project.language === 'java') {
      compileAndRunJava(project, {
        stdin: suppliedInputs.length > 0 ? suppliedInputs.join('\n') : undefined,
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
        hideNewProject={initialHash.hideNewProject}
        onRun={handleRun}
        onStop={handleStop}
        onNewProject={handleNewProject}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <FileTree
          files={project.files}
          activeFile={activeFile.path}
          onSelectFile={handleSelectFile}
          onAddFile={handleAddFile}
          onDeleteFile={handleDeleteFile}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <Editor
            filePath={activeFile.path}
            content={activeFile.content}
            syntaxColoring={syntaxColoring}
            onToggleSyntaxColoring={handleToggleSyntaxColoring}
            onChange={handleContentChange}
          />
          <XtermTerminal
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

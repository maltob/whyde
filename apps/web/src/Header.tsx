import React from 'react';
import { Play, Square, Save, HardDrive, WifiOff, Loader2 } from 'lucide-react';
import { Project } from '@ide/project-model';

interface HeaderProps {
  project: Project;
  saveStatus: 'saved' | 'saving' | 'error';
  isRunning: boolean;
  executionPhase?: 'idle' | 'compiling' | 'running';
  hideNewProject?: boolean;
  onRun: () => void;
  onStop: () => void;
  onNewProject: (lang: 'python' | 'java' | 'cpp', blank?: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  saveStatus,
  isRunning,
  executionPhase = isRunning ? 'running' : 'idle',
  hideNewProject = false,
  onRun,
  onStop,
  onNewProject,
}) => {
  return (
    <header
      role="banner"
      style={{
        height: '48px',
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        color: '#f8fafc',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#38bdf8' }}>
          Browser IDE
        </span>
        <span
          style={{
            fontSize: '0.9rem',
            fontWeight: 500,
            padding: '2px 8px',
            backgroundColor: '#1e293b',
            borderRadius: '4px',
            border: '1px solid #334155',
          }}
        >
          {project.name}
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '2px 6px',
            borderRadius: '3px',
            backgroundColor: '#0369a1',
            color: '#e0f2fe',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {project.language}
        </span>
        {/* Local-only badge per spec */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            padding: '2px 6px',
            borderRadius: '3px',
            backgroundColor: '#14532d',
            color: '#bbf7d0',
            fontWeight: 600,
          }}
        >
          <HardDrive size={12} />
          Local Only
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Save Status indicator */}
        <span
          style={{
            fontSize: '0.8rem',
            color: saveStatus === 'saved' ? '#4ade80' : saveStatus === 'saving' ? '#fbbf24' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Save size={14} />
          {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Save Error'}
        </span>

        {/* Language template switcher */}
        {!hideNewProject && (
          <select
            aria-label="New Project"
            onChange={(e) => {
              if (e.target.value) {
                const val = e.target.value;
                if (val.endsWith('-blank')) {
                  const lang = val.replace('-blank', '') as 'python' | 'java' | 'cpp';
                  onNewProject(lang, true);
                } else {
                  onNewProject(val as 'python' | 'java' | 'cpp', false);
                }
                e.target.value = '';
              }
            }}
            defaultValue=""
            style={{
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #475569',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <option value="" disabled>
              + New Project...
            </option>
            <optgroup label="Starter Demos">
              <option value="python">Python 3.14 (Starter)</option>
              <option value="java">Java 11+ (Starter)</option>
              <option value="cpp">C++17+ (Starter)</option>
            </optgroup>
            <optgroup label="Blank / Student Templates">
              <option value="python-blank">Python (Blank)</option>
              <option value="java-blank">Java (Blank)</option>
              <option value="cpp-blank">C++ (Blank)</option>
            </optgroup>
          </select>
        )}

        {/* Run / Compiling / Stop buttons */}
        {executionPhase === 'compiling' ? (
          <button
            aria-label="Compiling Code"
            onClick={onStop}
            style={{
              backgroundColor: '#0284c7',
              color: 'white',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(2, 132, 199, 0.4)',
            }}
          >
            <Loader2 size={14} className="animate-spin" />
            Compiling...
          </button>
        ) : !isRunning ? (
          <button
            aria-label="Run Code"
            onClick={onRun}
            style={{
              backgroundColor: '#16a34a',
              color: 'white',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Play size={14} />
            Run
          </button>
        ) : (
          <button
            aria-label="Stop Execution"
            onClick={onStop}
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Square size={14} />
            Stop
          </button>
        )}
      </div>
    </header>
  );
};

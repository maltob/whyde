import React, { useState } from 'react';
import { ProjectFile } from '@ide/project-model';
import { FileCode, Folder, Plus, Trash2 } from 'lucide-react';

interface FileTreeProps {
  files: ProjectFile[];
  activeFile: string;
  onSelectFile: (path: string) => void;
  onAddFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFile,
  onSelectFile,
  onAddFile,
  onDeleteFile,
}) => {
  const [newFileName, setNewFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const cleanPath = newFileName.trim().replace(/^[/\\]+/, '');
    onAddFile(cleanPath);
    setNewFileName('');
    setIsCreating(false);
  };

  return (
    <nav
      aria-label="Project Files"
      style={{
        width: '260px',
        backgroundColor: '#1e293b',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #334155',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', color: '#94a3b8' }}>
          EXPLORER
        </span>
        <button
          aria-label="New File"
          onClick={() => setIsCreating(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px',
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} style={{ padding: '8px 12px' }}>
          <input
            autoFocus
            type="text"
            placeholder="src/filename.ext"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onBlur={() => setIsCreating(false)}
            style={{
              width: '100%',
              padding: '4px 8px',
              backgroundColor: '#0f172a',
              border: '1px solid #3b82f6',
              borderRadius: '4px',
              color: '#f8fafc',
              fontSize: '0.85rem',
            }}
          />
        </form>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0', overflowY: 'auto', flex: 1 }}>
        {files.map((file) => {
          const isActive = file.path === activeFile;
          return (
            <li
              key={file.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 16px',
                backgroundColor: isActive ? '#334155' : 'transparent',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
              onClick={() => onSelectFile(file.path)}
              role="button"
              tabIndex={0}
              aria-current={isActive ? 'true' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelectFile(file.path);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <FileCode size={16} color={isActive ? '#38bdf8' : '#94a3b8'} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {file.path}
                </span>
              </div>
              {files.length > 1 && (
                <button
                  aria-label={`Delete ${file.path}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${file.path}?`)) {
                      onDeleteFile(file.path);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

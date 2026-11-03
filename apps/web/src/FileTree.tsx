import React, { useState, useMemo } from 'react';
import { ProjectFile } from '@ide/project-model';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FilePlus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Trash2,
} from 'lucide-react';

interface FileTreeProps {
  files: ProjectFile[];
  activeFile: string;
  onSelectFile: (path: string) => void;
  onAddFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
}

function buildTree(files: ProjectFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isFolder: true, children: [] };

  for (const file of files) {
    const parts = file.path.split(/[/\\]+/).filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      let existing = current.children.find((c) => c.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          isFolder: !isLast,
          children: [],
        };
        current.children.push(existing);
      }
      current = existing;
    }
  }

  // Sort folders first, then files alphabetically
  function sortNode(node: TreeNode) {
    node.children.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      if (child.isFolder) sortNode(child);
    }
  }

  sortNode(root);
  return root;
}

function getFileIcon(name: string, isActive: boolean) {
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
    return <FileText size={15} color={isActive ? '#38bdf8' : '#e2e8f0'} />;
  }
  return <FileCode size={15} color={isActive ? '#38bdf8' : '#94a3b8'} />;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFile,
  onSelectFile,
  onAddFile,
  onDeleteFile,
}) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [newItemName, setNewItemName] = useState('');

  const tree = useMemo(() => buildTree(files), [files]);

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newItemName.trim().replace(/^[/\\]+/, '');
    if (!cleanName) {
      setIsCreating(false);
      return;
    }
    const finalPath = createType === 'folder' ? `${cleanName}/.keep` : cleanName;
    onAddFile(finalPath);
    setNewItemName('');
    setIsCreating(false);
  };

  const renderTree = (node: TreeNode, depth: number = 0) => {
    return node.children.map((child) => {
      const paddingLeft = `${12 + depth * 14}px`;

      if (child.isFolder) {
        const isCollapsed = collapsedFolders[child.path] ?? false;
        return (
          <div key={child.path}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleFolder(child.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 10px',
                paddingLeft,
                cursor: 'pointer',
                fontSize: '0.825rem',
                color: '#cbd5e1',
                gap: '6px',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {isCollapsed ? <ChevronRight size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
              {isCollapsed ? <Folder size={15} color="#38bdf8" /> : <FolderOpen size={15} color="#38bdf8" />}
              <span style={{ fontWeight: 500 }}>{child.name}</span>
            </div>
            {!isCollapsed && renderTree(child, depth + 1)}
          </div>
        );
      }

      // Hide placeholder .keep files
      if (child.name === '.keep') return null;

      const isActive = child.path === activeFile;
      return (
        <div
          key={child.path}
          role="button"
          tabIndex={0}
          onClick={() => onSelectFile(child.path)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 10px',
            paddingLeft: `${12 + depth * 14 + 18}px`,
            cursor: 'pointer',
            fontSize: '0.825rem',
            backgroundColor: isActive ? '#1e293b' : 'transparent',
            color: isActive ? '#f8fafc' : '#94a3b8',
            borderLeft: isActive ? '2px solid #38bdf8' : '2px solid transparent',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            if (!isActive) e.currentTarget.style.backgroundColor = '#0f172a';
          }}
          onMouseLeave={(e) => {
            if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            {getFileIcon(child.name, isActive)}
            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {child.name}
            </span>
          </div>
          {files.length > 1 && (
            <button
              aria-label={`Delete ${child.path}`}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete ${child.path}?`)) {
                  onDeleteFile(child.path);
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#475569',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#f87171')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#475569')}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      );
    });
  };

  return (
    <nav
      aria-label="Project Files"
      style={{
        width: '240px',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #1e293b',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b' }}>
          EXPLORER
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            title="New File"
            aria-label="New File"
            onClick={() => {
              setCreateType('file');
              setIsCreating(true);
            }}
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
            <FilePlus size={15} />
          </button>
          <button
            title="New Folder"
            aria-label="New Folder"
            onClick={() => {
              setCreateType('folder');
              setIsCreating(true);
            }}
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
            <FolderPlus size={15} />
          </button>
        </div>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateSubmit} style={{ padding: '6px 12px' }}>
          <input
            autoFocus
            type="text"
            placeholder={createType === 'folder' ? 'folder_name' : 'filename.txt'}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onBlur={() => setIsCreating(false)}
            style={{
              width: '100%',
              padding: '3px 6px',
              backgroundColor: '#0f172a',
              border: '1px solid #38bdf8',
              borderRadius: '3px',
              color: '#f8fafc',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
        </form>
      )}

      <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
        {renderTree(tree)}
      </div>
    </nav>
  );
};

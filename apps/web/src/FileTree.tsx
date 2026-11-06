import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Edit2,
  Copy,
  CornerUpLeft,
} from 'lucide-react';

interface FileTreeProps {
  files: ProjectFile[];
  activeFile: string;
  onSelectFile: (path: string) => void;
  onAddFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile?: (oldPath: string, newPath: string) => void;
  onMoveFile?: (sourcePath: string, targetDirPath: string) => void;
  onDuplicateFile?: (path: string) => void;
  onUploadFiles?: (uploaded: { path: string; content: string }[]) => void;
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
  const ext = name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'py':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            fontSize: '9px',
            fontWeight: 800,
            borderRadius: '3px',
            backgroundColor: '#fbbf24',
            color: '#090d16',
            lineHeight: 1,
            userSelect: 'none',
          }}
          title="Python"
        >
          Py
        </span>
      );
    case 'js':
    case 'mjs':
    case 'cjs':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            fontSize: '9px',
            fontWeight: 800,
            borderRadius: '3px',
            backgroundColor: '#facc15',
            color: '#090d16',
            lineHeight: 1,
            userSelect: 'none',
          }}
          title="JavaScript"
        >
          JS
        </span>
      );
    case 'cpp':
    case 'cc':
    case 'cxx':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            fontSize: '9px',
            fontWeight: 800,
            borderRadius: '3px',
            backgroundColor: '#38bdf8',
            color: '#090d16',
            lineHeight: 1,
            userSelect: 'none',
          }}
          title="C++"
        >
          C+
        </span>
      );
    case 'hpp':
    case 'h':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            fontSize: '9px',
            fontWeight: 800,
            borderRadius: '3px',
            backgroundColor: '#a855f7',
            color: '#ffffff',
            lineHeight: 1,
            userSelect: 'none',
          }}
          title="Header"
        >
          H
        </span>
      );
    case 'java':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            fontSize: '9px',
            fontWeight: 800,
            borderRadius: '3px',
            backgroundColor: '#f97316',
            color: '#ffffff',
            lineHeight: 1,
            userSelect: 'none',
          }}
          title="Java"
        >
          Jv
        </span>
      );
    case 'json':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            fontSize: '9px',
            fontWeight: 800,
            borderRadius: '3px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            lineHeight: 1,
            userSelect: 'none',
          }}
          title="JSON"
        >
          {"{}"}
        </span>
      );
    case 'txt':
    case 'md':
    case 'csv':
    case 'log':
      return <FileText size={15} color={isActive ? '#38bdf8' : '#94a3b8'} />;
    default:
      return <FileCode size={15} color={isActive ? '#38bdf8' : '#64748b'} />;
  }
}

interface ContextMenuState {
  x: number;
  y: number;
  path: string;
  name: string;
  isFolder: boolean;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFile,
  onSelectFile,
  onAddFile,
  onDeleteFile,
  onRenameFile,
  onMoveFile,
  onDuplicateFile,
  onUploadFiles,
}) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [newItemName, setNewItemName] = useState('');
  const [createParentDir, setCreateParentDir] = useState<string>('');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Renaming State
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  // Drag & Drop State
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);

  const tree = useMemo(() => buildTree(files), [files]);

  // Handle external native OS file drops (drag and drop file upload)
  const handleNativeDrop = async (e: React.DragEvent) => {
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsExternalDragOver(false);

    const uploaded: { path: string; content: string }[] = [];
    const fileList = Array.from(e.dataTransfer.files);

    for (const f of fileList) {
      try {
        const text = await f.text();
        // sanitize name
        const cleanName = f.name.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
        if (cleanName) {
          uploaded.push({ path: cleanName, content: text });
        }
      } catch (err) {
        console.error('Failed to read dropped file:', f.name, err);
      }
    }

    if (uploaded.length > 0 && onUploadFiles) {
      onUploadFiles(uploaded);
    }
  };

  // Close context menu on external click or Escape key
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setRenamingPath(null);
      }
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath]);

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
      setCreateParentDir('');
      return;
    }
    const fullPrefix = createParentDir ? `${createParentDir.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '')}/` : '';
    const finalPath = createType === 'folder' ? `${fullPrefix}${cleanName}/.keep` : `${fullPrefix}${cleanName}`;
    onAddFile(finalPath);
    setNewItemName('');
    setIsCreating(false);
    setCreateParentDir('');
  };

  const handleRenameSubmit = (e: React.FormEvent, oldPath: string) => {
    e.preventDefault();
    const cleanNewName = renameInput.trim().replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
    if (!cleanNewName) {
      setRenamingPath(null);
      return;
    }

    const parts = oldPath.split('/');
    parts[parts.length - 1] = cleanNewName;
    const newPath = parts.join('/');

    if (newPath !== oldPath) {
      onRenameFile?.(oldPath, newPath);
    }
    setRenamingPath(null);
  };

  const handleContextMenu = (e: React.MouseEvent, path: string, name: string, isFolder: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 180),
      y: Math.min(e.clientY, window.innerHeight - 200),
      path,
      name,
      isFolder,
    });
  };

  const startRename = (path: string, currentName: string) => {
    setRenamingPath(path);
    setRenameInput(currentName);
    setContextMenu(null);
  };

  const renderTree = (node: TreeNode, depth: number = 0) => {
    return node.children.map((child) => {
      const paddingLeft = `${12 + depth * 14}px`;
      const isRenaming = renamingPath === child.path;
      const isDragTarget = dragOverPath === child.path;

      if (child.isFolder) {
        const isCollapsed = collapsedFolders[child.path] ?? false;
        return (
          <div
            key={child.path}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              if (draggedPath && draggedPath !== child.path && !child.path.startsWith(draggedPath + '/')) {
                setDragOverPath(child.path);
              }
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) {
                setDragOverPath((p) => (p === child.path ? null : p));
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverPath(null);
              const src = e.dataTransfer.getData('text/plain');
              if (src && src !== child.path && !child.path.startsWith(src + '/')) {
                onMoveFile?.(src, child.path);
              }
            }}
            style={{
              outline: isDragTarget ? '1px dashed #38bdf8' : 'none',
              backgroundColor: isDragTarget ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
            }}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label={`Folder ${child.name}`}
              aria-expanded={!isCollapsed}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFolder(child.path);
                }
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', child.path);
                e.dataTransfer.effectAllowed = 'move';
                setDraggedPath(child.path);
              }}
              onDragEnd={() => {
                setDraggedPath(null);
                setDragOverPath(null);
              }}
              onClick={() => toggleFolder(child.path)}
              onContextMenu={(e) => handleContextMenu(e, child.path, child.name, true)}
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
              {isRenaming ? (
                <form
                  onSubmit={(e) => handleRenameSubmit(e, child.path)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'inline-flex', flex: 1 }}
                >
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onBlur={(e) => handleRenameSubmit(e, child.path)}
                    style={{
                      width: '100%',
                      padding: '1px 4px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #38bdf8',
                      borderRadius: '2px',
                      color: '#f8fafc',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                </form>
              ) : (
                <span style={{ fontWeight: 500 }}>{child.name}</span>
              )}
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
          aria-label={`File ${child.name}${isActive ? ' (active)' : ''}`}
          aria-current={isActive ? 'true' : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectFile(child.path);
            }
          }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', child.path);
            e.dataTransfer.effectAllowed = 'move';
            setDraggedPath(child.path);
          }}
          onDragEnd={() => {
            setDraggedPath(null);
            setDragOverPath(null);
          }}
          onClick={() => onSelectFile(child.path)}
          onContextMenu={(e) => handleContextMenu(e, child.path, child.name, false)}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
            {getFileIcon(child.name, isActive)}
            {isRenaming ? (
              <form
                onSubmit={(e) => handleRenameSubmit(e, child.path)}
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'inline-flex', flex: 1 }}
              >
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  onBlur={(e) => handleRenameSubmit(e, child.path)}
                  style={{
                    width: '100%',
                    padding: '1px 4px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #38bdf8',
                    borderRadius: '2px',
                    color: '#f8fafc',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </form>
            ) : (
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {child.name}
              </span>
            )}
          </div>
          {files.length > 1 && !isRenaming && (
            <button
              aria-label={`Delete ${child.path}`}
              title="Delete"
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

  const isRootDragOver = dragOverPath === '__ROOT__';

  return (
    <nav
      aria-label="Project Files"
      onDragOver={(e) => {
        // Detect if external files are being dragged over the explorer
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setIsExternalDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsExternalDragOver(false);
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleNativeDrop(e);
        }
      }}
      onContextMenu={(e) => {
        // Right-clicking empty space in tree opens Root Context Menu
        if (e.target === e.currentTarget || (e.target as HTMLElement).getAttribute('data-empty-drop-zone')) {
          handleContextMenu(e, '', '', true);
        }
      }}
      style={{
        width: '240px',
        backgroundColor: isExternalDragOver ? 'rgba(56, 189, 248, 0.05)' : '#090d16',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #1e293b',
        border: isExternalDragOver ? '2px dashed #38bdf8' : undefined,
        userSelect: 'none',
        position: 'relative',
        transition: 'all 0.15s ease',
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
              setCreateParentDir('');
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
              setCreateParentDir('');
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
            placeholder={
              createType === 'folder'
                ? createParentDir ? `${createParentDir}/folder` : 'folder_name'
                : createParentDir ? `${createParentDir}/file.ext` : 'filename.txt'
            }
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onBlur={() => {
              setIsCreating(false);
              setCreateParentDir('');
            }}
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

      <div
        data-empty-drop-zone="true"
        onContextMenu={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).getAttribute('data-empty-drop-zone')) {
            handleContextMenu(e, '', 'Root', true);
          }
        }}
        style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}
      >
        {renderTree(tree)}
      </div>

      {/* Root Drop Zone: Dragging any file down here moves it out of its folder back to root */}
      <div
        data-empty-drop-zone="true"
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
            setIsExternalDragOver(true);
            return;
          }
          e.dataTransfer.dropEffect = 'move';
          if (draggedPath && draggedPath.includes('/')) {
            setDragOverPath('__ROOT__');
          }
        }}
        onDragLeave={() => setDragOverPath(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverPath(null);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleNativeDrop(e);
            return;
          }
          const src = e.dataTransfer.getData('text/plain');
          if (src && src.includes('/')) {
            onMoveFile?.(src, '');
          }
        }}
        style={{
          minHeight: '40px',
          padding: '8px',
          margin: '4px 8px',
          border: isRootDragOver ? '1px dashed #38bdf8' : '1px dashed transparent',
          backgroundColor: isRootDragOver ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.72rem',
          color: isRootDragOver ? '#38bdf8' : '#475569',
          transition: 'all 0.15s ease',
        }}
      >
        {isRootDragOver ? 'Drop here to move to Root' : isExternalDragOver ? 'Drop file to upload' : ''}
      </div>

      {/* Right-Click Context Menu Popup */}
      {contextMenu && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 9999,
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            padding: '4px 0',
            minWidth: '160px',
            fontSize: '0.8rem',
            color: '#e2e8f0',
          }}
        >
          {contextMenu.path && (
            <button
              onClick={() => startRename(contextMenu.path, contextMenu.name)}
              style={menuItemStyle}
              onMouseEnter={menuItemHover}
              onMouseLeave={menuItemLeave}
            >
              <Edit2 size={13} color="#94a3b8" />
              <span>Rename</span>
            </button>
          )}

          {contextMenu.isFolder && (
            <>
              <button
                onClick={() => {
                  setCreateParentDir(contextMenu.path);
                  setCreateType('file');
                  setIsCreating(true);
                  setContextMenu(null);
                }}
                style={menuItemStyle}
                onMouseEnter={menuItemHover}
                onMouseLeave={menuItemLeave}
              >
                <FilePlus size={13} color="#38bdf8" />
                <span>{contextMenu.path ? 'New File Here' : 'New File in Root'}</span>
              </button>
              <button
                onClick={() => {
                  setCreateParentDir(contextMenu.path);
                  setCreateType('folder');
                  setIsCreating(true);
                  setContextMenu(null);
                }}
                style={menuItemStyle}
                onMouseEnter={menuItemHover}
                onMouseLeave={menuItemLeave}
              >
                <FolderPlus size={13} color="#38bdf8" />
                <span>{contextMenu.path ? 'New Folder Here' : 'New Folder in Root'}</span>
              </button>
            </>
          )}

          {!contextMenu.isFolder && contextMenu.path && onDuplicateFile && (
            <button
              onClick={() => {
                onDuplicateFile(contextMenu.path);
                setContextMenu(null);
              }}
              style={menuItemStyle}
              onMouseEnter={menuItemHover}
              onMouseLeave={menuItemLeave}
            >
              <Copy size={13} color="#94a3b8" />
              <span>Duplicate</span>
            </button>
          )}

          {contextMenu.path && contextMenu.path.includes('/') && onMoveFile && (
            <button
              onClick={() => {
                onMoveFile(contextMenu.path, '');
                setContextMenu(null);
              }}
              style={menuItemStyle}
              onMouseEnter={menuItemHover}
              onMouseLeave={menuItemLeave}
            >
              <CornerUpLeft size={13} color="#94a3b8" />
              <span>Move to Root</span>
            </button>
          )}

          {contextMenu.path && (
            <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '4px 0' }} />
          )}

          {contextMenu.path && files.length > 1 && (
            <button
              onClick={() => {
                setContextMenu(null);
                if (confirm(`Delete ${contextMenu.path}?`)) {
                  onDeleteFile(contextMenu.path);
                }
              }}
              style={{ ...menuItemStyle, color: '#f87171' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)')}
              onMouseLeave={menuItemLeave}
            >
              <Trash2 size={13} color="#f87171" />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '6px 12px',
  background: 'none',
  border: 'none',
  color: '#e2e8f0',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: '0.8rem',
  transition: 'background-color 0.1s ease',
};

const menuItemHover = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.backgroundColor = '#1e293b';
};

const menuItemLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.backgroundColor = 'transparent';
};

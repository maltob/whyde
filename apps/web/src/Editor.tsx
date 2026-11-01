import React from 'react';

interface EditorProps {
  filePath: string;
  content: string;
  onChange: (newContent: string) => void;
}

export const Editor: React.FC<EditorProps> = ({ filePath, content, onChange }) => {
  return (
    <main
      role="region"
      aria-label={`Code Editor: ${filePath}`}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
        overflow: 'hidden',
      }}
    >
      {/* Tab Header */}
      <div
        style={{
          display: 'flex',
          backgroundColor: '#090d16',
          borderBottom: '1px solid #1e293b',
          padding: '0 8px',
        }}
      >
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#0f172a',
            color: '#38bdf8',
            fontSize: '0.85rem',
            borderTop: '2px solid #38bdf8',
            fontWeight: 500,
          }}
        >
          {filePath}
        </div>
      </div>

      {/* Accessible Text Area / Editor Surface */}
      <textarea
        aria-label="Source Code"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          width: '100%',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: 'none',
          padding: '16px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '14px',
          lineHeight: '1.6',
          outline: 'none',
          resize: 'none',
          whiteSpace: 'pre',
          overflowWrap: 'normal',
          overflowX: 'auto',
        }}
      />
    </main>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Trash2 } from 'lucide-react';

interface TerminalProps {
  logs: { type: 'stdout' | 'stderr' | 'info'; text: string }[];
  pendingStdin: { requestId: string; prompt?: string } | null;
  onSupplyStdin: (requestId: string, input: string) => void;
  onClear: () => void;
}

export const Terminal: React.FC<TerminalProps> = ({
  logs,
  pendingStdin,
  onSupplyStdin,
  onClear,
}) => {
  const [inputText, setInputText] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (pendingStdin) {
      inputRef.current?.focus();
    }
  }, [logs, pendingStdin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingStdin) return;
    const value = inputText;
    setInputText('');
    onSupplyStdin(pendingStdin.requestId, value);
  };

  const handleTerminalClick = () => {
    if (pendingStdin) {
      inputRef.current?.focus();
    }
  };

  return (
    <section
      aria-label="Interactive Terminal and Output"
      onClick={handleTerminalClick}
      style={{
        height: '240px',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        borderTop: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        cursor: pendingStdin ? 'text' : 'default',
      }}
    >
      <div
        style={{
          padding: '6px 16px',
          backgroundColor: '#0f172a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.8rem',
          color: '#94a3b8',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TerminalIcon size={14} />
          <span>TERMINAL</span>
        </div>
        <button
          aria-label="Clear Console"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
          }}
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>

      <div
        role="log"
        aria-live="polite"
        style={{
          flex: 1,
          padding: '12px 16px',
          overflowY: 'auto',
          fontSize: '0.875rem',
          lineHeight: 1.5,
        }}
      >
        {logs.length === 0 && !pendingStdin ? (
          <span style={{ color: '#475569' }}>Program output will appear here. Press Run to execute.</span>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              style={{
                color: log.type === 'stderr' ? '#f87171' : log.type === 'info' ? '#38bdf8' : '#e2e8f0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {log.text}
            </div>
          ))
        )}

        {/* Real inline terminal stdin prompt */}
        {pendingStdin && (
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              margin: '2px 0',
            }}
          >
            <span style={{ color: '#e2e8f0', marginRight: '6px', whiteSpace: 'pre' }}>
              {pendingStdin.prompt || '> '}
            </span>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flex: 1, minWidth: '120px' }}>
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fbbf24',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  lineHeight: 'inherit',
                  width: '100%',
                  padding: 0,
                  margin: 0,
                  caretColor: '#38bdf8',
                }}
              />
            </div>
          </form>
        )}
        <div ref={logEndRef} />
      </div>
    </section>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Send, Trash2 } from 'lucide-react';

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

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingStdin) return;
    onSupplyStdin(pendingStdin.requestId, inputText);
    setInputText('');
  };

  return (
    <section
      aria-label="Interactive Terminal and Output"
      style={{
        height: '240px',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        borderTop: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'ui-monospace, monospace',
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
          <span>CONSOLE / STDIN</span>
        </div>
        <button
          aria-label="Clear Console"
          onClick={onClear}
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
          fontSize: '0.85rem',
          lineHeight: 1.4,
        }}
      >
        {logs.length === 0 ? (
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
        <div ref={logEndRef} />
      </div>

      {pendingStdin && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            borderTop: '1px solid #1e293b',
            backgroundColor: '#0f172a',
            padding: '6px 12px',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <label htmlFor="stdin-input" style={{ fontSize: '0.8rem', color: '#fbbf24' }}>
            {pendingStdin.prompt || 'Input requested >'}
          </label>
          <input
            id="stdin-input"
            autoFocus
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: '#090d16',
              border: '1px solid #3b82f6',
              borderRadius: '4px',
              padding: '6px 8px',
              color: '#f8fafc',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
            }}
          />
          <button
            type="submit"
            aria-label="Send Input"
            style={{
              backgroundColor: '#2563eb',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.8rem',
            }}
          >
            <Send size={14} />
            Submit
          </button>
        </form>
      )}
    </section>
  );
};

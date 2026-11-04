import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, Trash2, Maximize2, Minimize2 } from 'lucide-react';

export interface TerminalProps {
  logs: { type: 'stdout' | 'stderr' | 'info'; text: string }[];
  pendingStdin: { requestId: string; prompt?: string } | null;
  onSupplyStdin: (requestId: string, input: string) => void;
  onData?: (data: string) => void;
  onClear: () => void;
  rawMode?: boolean; // When true, passes every character directly without local line editing
  height?: number | string;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const XtermTerminal: React.FC<TerminalProps> = ({
  logs,
  pendingStdin,
  onSupplyStdin,
  onData,
  onClear,
  rawMode = false,
  height = 240,
  isMaximized = false,
  onToggleMaximize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lineBufferRef = useRef<string>('');
  const lastRenderedLogIndexRef = useRef<number>(0);

  // Keep latest callbacks/props in refs so listeners don't have stale closures
  const pendingStdinRef = useRef(pendingStdin);
  pendingStdinRef.current = pendingStdin;

  const onSupplyStdinRef = useRef(onSupplyStdin);
  onSupplyStdinRef.current = onSupplyStdin;

  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  const rawModeRef = useRef(rawMode);
  rawModeRef.current = rawMode;

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      theme: {
        background: '#090d16',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        selectionBackground: '#1e3a8a',
        black: '#0f172a',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#f8fafc',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    try {
      fitAddon.fit();
    } catch {}

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle character input from terminal emulator
    term.onData((data) => {
      // If consumer provided a raw streaming character handler, pipe directly
      if (onDataRef.current) {
        onDataRef.current(data);
      }

      if (rawModeRef.current) {
        // Raw mode: do not locally line-edit or buffer, data stream already sent
        return;
      }

      // Canonical TTY emulation (line buffering with immediate key echoes)
      if (data === '\r' || data === '\n') {
        // Enter pressed: newline + flush line buffer
        term.write('\r\n');
        const submitted = lineBufferRef.current;
        lineBufferRef.current = '';
        if (pendingStdinRef.current) {
          onSupplyStdinRef.current(pendingStdinRef.current.requestId, submitted);
        }
      } else if (data === '\u007f' || data === '\b') {
        // Backspace: handle erase
        if (lineBufferRef.current.length > 0) {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
      } else if (data >= ' ' || data === '\t') {
        // Printable characters
        lineBufferRef.current += data;
        term.write(data);
      }
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {}
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  // Update terminal whenever new logs arrive
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    if (logs.length === 0) {
      term.clear();
      lastRenderedLogIndexRef.current = 0;
      lineBufferRef.current = '';
      return;
    }

    // Write new logs that haven't been rendered yet
    for (let i = lastRenderedLogIndexRef.current; i < logs.length; i++) {
      const log = logs[i];
      // Convert standalone LF to CRLF for VT100 compliance
      const formatted = log.text.replace(/\r?\n/g, '\r\n');

      if (log.type === 'stderr') {
        term.write(`\x1b[31m${formatted}\x1b[0m`);
      } else if (log.type === 'info') {
        term.write(`\x1b[36m${formatted}\x1b[0m`);
      } else {
        term.write(formatted);
      }
    }
    lastRenderedLogIndexRef.current = logs.length;
  }, [logs]);

  // When pendingStdin changes, focus terminal
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    if (pendingStdin) {
      term.focus();
      lineBufferRef.current = '';
    }
  }, [pendingStdin]);

  const handleClear = () => {
    const term = termRef.current;
    if (term) {
      term.clear();
      lineBufferRef.current = '';
      lastRenderedLogIndexRef.current = 0;
    }
    onClear();
  };

  // Refit whenever height or isMaximized changes
  useEffect(() => {
    try {
      fitAddonRef.current?.fit();
    } catch {}
  }, [height, isMaximized]);

  return (
    <section
      aria-label="Interactive Terminal Emulator and Output"
      style={{
        height: isMaximized ? '100%' : typeof height === 'number' ? `${height}px` : height,
        flex: isMaximized ? 1 : undefined,
        backgroundColor: '#090d16',
        color: '#f8fafc',
        borderTop: isMaximized ? 'none' : '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '80px',
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
          <span>TERMINAL EMULATOR (VT100 / XTERM)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            aria-label="Clear Console"
            onClick={handleClear}
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
          {onToggleMaximize && (
            <button
              aria-label={isMaximized ? 'Restore Terminal' : 'Maximize Terminal'}
              title={isMaximized ? 'Restore' : 'Maximize'}
              onClick={onToggleMaximize}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
              }}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: '8px 12px',
          overflow: 'hidden',
        }}
      />
    </section>
  );
};

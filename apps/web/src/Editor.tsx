import React, { useState, useRef, useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-c.js';
import 'prismjs/components/prism-cpp.js';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/themes/prism-tomorrow.css';
import { AlignLeft, Check, Palette } from 'lucide-react';
import { formatCode } from './formatter.js';

interface EditorProps {
  filePath: string;
  content: string;
  onChange: (newContent: string) => void;
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'python';
    case 'cpp':
    case 'hpp':
    case 'cc':
    case 'h':
      return 'cpp';
    case 'java':
      return 'java';
    case 'json':
      return 'json';
    default:
      return 'plaintext';
  }
}

export const Editor: React.FC<EditorProps> = ({ filePath, content, onChange }) => {
  const [syntaxColoring, setSyntaxColoring] = useState<boolean>(true);
  const [formattedFeedback, setFormattedFeedback] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const lang = getLanguage(filePath);

  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleFormat = () => {
    const formatted = formatCode(content, filePath);
    onChange(formatted);
    setFormattedFeedback(true);
    setTimeout(() => setFormattedFeedback(false), 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key inserts 4 spaces instead of losing focus
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = content.substring(0, start) + '    ' + content.substring(end);
      onChange(updated);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      });
    }
  };

  const highlightedHtml = React.useMemo(() => {
    if (!syntaxColoring || lang === 'plaintext') {
      return '';
    }
    const grammar = Prism.languages[lang];
    if (!grammar) return '';
    try {
      return Prism.highlight(content + '\n', grammar, lang);
    } catch {
      return '';
    }
  }, [content, lang, syntaxColoring]);

  return (
    <main
      role="region"
      aria-label={`Code Editor: ${filePath}`}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#090d16',
        overflow: 'hidden',
      }}
    >
      {/* Tab & Action Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#090d16',
          borderBottom: '1px solid #1e293b',
          padding: '0 12px 0 0',
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

        {/* Toolbar: Color Coding Toggle & Code Formatter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            title="Toggle Syntax Highlighting"
            onClick={() => setSyntaxColoring(!syntaxColoring)}
            style={{
              background: syntaxColoring ? '#1e293b' : 'transparent',
              border: '1px solid #334155',
              color: syntaxColoring ? '#38bdf8' : '#64748b',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Palette size={13} />
            <span>Highlighting: {syntaxColoring ? 'ON' : 'OFF'}</span>
          </button>

          <button
            title="Format Code"
            onClick={handleFormat}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: formattedFeedback ? '#4ade80' : '#e2e8f0',
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {formattedFeedback ? <Check size={13} /> : <AlignLeft size={13} />}
            <span>{formattedFeedback ? 'Formatted!' : 'Format Code'}</span>
          </button>
        </div>
      </div>

      {/* Editor Container with Overlay Highlighting */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          backgroundColor: '#090d16',
        }}
      >
        {/* Syntax Highlighting Underlay */}
        {syntaxColoring && lang !== 'plaintext' && (
          <pre
            ref={preRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              margin: 0,
              padding: '16px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre',
              overflow: 'hidden',
              pointerEvents: 'none',
              backgroundColor: 'transparent',
              boxSizing: 'border-box',
            }}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        )}

        {/* Input Textarea Overlay */}
        <textarea
          ref={textareaRef}
          aria-label="Source Code"
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: syntaxColoring && lang !== 'plaintext' ? 'transparent' : '#090d16',
            color: syntaxColoring && lang !== 'plaintext' ? 'transparent' : '#f8fafc',
            caretColor: '#38bdf8',
            border: 'none',
            padding: '16px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '14px',
            lineHeight: '1.6',
            outline: 'none',
            resize: 'none',
            whiteSpace: 'pre',
            overflowWrap: 'normal',
            overflow: 'auto',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </main>
  );
};

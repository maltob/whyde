import React, { useState, useRef, useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-c.js';
import 'prismjs/components/prism-cpp.js';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/themes/prism-tomorrow.css';
import { AlignLeft, Check, Palette, Sparkles } from 'lucide-react';
import { formatCode } from './formatter.js';
import { getSuggestions, SuggestionItem } from './codeSuggest.js';

interface EditorProps {
  filePath: string;
  content: string;
  syntaxColoring?: boolean;
  onToggleSyntaxColoring?: (enabled: boolean) => void;
  codeSuggest?: boolean;
  onToggleCodeSuggest?: (enabled: boolean) => void;
  allFilePaths?: string[];
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

export const Editor: React.FC<EditorProps> = ({
  filePath,
  content,
  syntaxColoring = true,
  onToggleSyntaxColoring,
  codeSuggest = true,
  onToggleCodeSuggest,
  allFilePaths = [],
  onChange,
}) => {
  const [internalSyntaxColoring, setInternalSyntaxColoring] = useState<boolean>(syntaxColoring);
  const [internalCodeSuggest, setInternalCodeSuggest] = useState<boolean>(codeSuggest);
  const [formattedFeedback, setFormattedFeedback] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [suggestionRange, setSuggestionRange] = useState<{ start: number; end: number } | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setInternalSyntaxColoring(syntaxColoring);
  }, [syntaxColoring]);

  useEffect(() => {
    setInternalCodeSuggest(codeSuggest);
  }, [codeSuggest]);

  const activeColoring = onToggleSyntaxColoring ? syntaxColoring : internalSyntaxColoring;
  const activeSuggest = onToggleCodeSuggest ? codeSuggest : internalCodeSuggest;

  const toggleColoring = () => {
    const next = !activeColoring;
    setInternalSyntaxColoring(next);
    onToggleSyntaxColoring?.(next);
  };

  const toggleSuggest = () => {
    const next = !activeSuggest;
    setInternalCodeSuggest(next);
    onToggleCodeSuggest?.(next);
    if (!next) {
      setSuggestions([]);
    }
  };

  const updateSuggestions = (text: string, cursor: number) => {
    if (!activeSuggest) {
      setSuggestions([]);
      return;
    }
    const res = getSuggestions(text, cursor, filePath, allFilePaths);
    if (res.items.length > 0 && res.prefix.length >= 1) {
      setSuggestions(res.items);
      setSelectedIndex(0);
      setSuggestionRange({ start: res.replaceStart, end: cursor });

      // Approximate coordinates based on line count and character offset
      const textBefore = text.slice(0, cursor);
      const lines = textBefore.split('\n');
      const curLineIdx = lines.length - 1;
      const colIdx = lines[curLineIdx].length;

      const lineHeight = 22.4; // 14px * 1.6
      const charWidth = 8.4; // monospace approx
      const top = Math.min((curLineIdx + 1) * lineHeight + 18, 400);
      const left = Math.min(colIdx * charWidth + 18, 500);
      setDropdownPos({ top, left });
    } else {
      setSuggestions([]);
      setSuggestionRange(null);
    }
  };

  const applySuggestion = (item: SuggestionItem) => {
    if (!suggestionRange || !textareaRef.current) return;
    const cleanInsert = item.insertText.replace(/\$\{\d+:([^}]+)\}/g, '$1').replace(/\$\d+/g, '');
    const before = content.slice(0, suggestionRange.start);
    const after = content.slice(suggestionRange.end);
    const newContent = before + cleanInsert + after;
    onChange(newContent);
    const newCursor = before.length + cleanInsert.length;
    setSuggestions([]);
    setSuggestionRange(null);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newCursor;
      }
    });
  };

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
    // Autocomplete popup keyboard navigation
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestions([]);
        return;
      }
    }

    // Tab key: indent or outdent (Shift+Tab) supporting single and multi-line selections
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      // Check if multi-line selection or single cursor on a line with selection
      const isMultiLine = content.slice(start, end).includes('\n');

      if (!isMultiLine && !e.shiftKey) {
        // Single cursor or inline selection: insert 4 spaces
        const updated = content.substring(0, start) + '    ' + content.substring(end);
        onChange(updated);
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + 4;
        });
        return;
      }

      // Multi-line selection or Shift+Tab outdent on current line
      // Find the start of the first line
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      // Find the end of the last line
      let lineEnd = content.indexOf('\n', end);
      if (lineEnd === -1) {
        lineEnd = content.length;
      }

      const selectedLinesText = content.substring(lineStart, lineEnd);
      const lines = selectedLinesText.split('\n');

      let newStart = start;
      let newEnd = end;

      if (!e.shiftKey) {
        // Indent: add 4 spaces to each selected line
        const indentedLines = lines.map((line, idx) => {
          if (idx === 0) newStart += 4;
          newEnd += 4;
          return '    ' + line;
        });
        const updated =
          content.substring(0, lineStart) + indentedLines.join('\n') + content.substring(lineEnd);
        onChange(updated);
        requestAnimationFrame(() => {
          target.selectionStart = newStart;
          target.selectionEnd = newEnd;
        });
      } else {
        // Outdent (Shift+Tab): remove up to 4 leading spaces (or 1 tab) from each line
        const outdentedLines = lines.map((line, idx) => {
          const match = line.match(/^( {1,4}|\t)/);
          if (match) {
            const removed = match[0].length;
            if (idx === 0) {
              newStart = Math.max(lineStart, newStart - removed);
            }
            newEnd = Math.max(lineStart, newEnd - removed);
            return line.substring(removed);
          }
          return line;
        });
        const updated =
          content.substring(0, lineStart) + outdentedLines.join('\n') + content.substring(lineEnd);
        onChange(updated);
        requestAnimationFrame(() => {
          target.selectionStart = newStart;
          target.selectionEnd = newEnd;
        });
      }
    }
  };

  const highlightedHtml = React.useMemo(() => {
    if (!activeColoring || lang === 'plaintext') {
      return '';
    }
    const grammar = Prism.languages[lang];
    if (!grammar) return '';
    try {
      return Prism.highlight(content + '\n', grammar, lang);
    } catch {
      return '';
    }
  }, [content, lang, activeColoring]);

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
            title="Toggle Code Suggestions"
            onClick={toggleSuggest}
            style={{
              background: activeSuggest ? '#1e293b' : 'transparent',
              border: '1px solid #334155',
              color: activeSuggest ? '#38bdf8' : '#64748b',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Sparkles size={13} />
            <span>Suggest: {activeSuggest ? 'ON' : 'OFF'}</span>
          </button>

          <button
            title="Toggle Syntax Highlighting"
            onClick={toggleColoring}
            style={{
              background: activeColoring ? '#1e293b' : 'transparent',
              border: '1px solid #334155',
              color: activeColoring ? '#38bdf8' : '#64748b',
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
            <span>Highlighting: {activeColoring ? 'ON' : 'OFF'}</span>
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
        {activeColoring && lang !== 'plaintext' && (
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
          onChange={(e) => {
            onChange(e.target.value);
            const cursor = e.target.selectionStart;
            updateSuggestions(e.target.value, cursor);
          }}
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            const cursor = (e.target as HTMLTextAreaElement).selectionStart;
            updateSuggestions(content, cursor);
          }}
          onScroll={handleScroll}
          spellCheck={false}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: activeColoring && lang !== 'plaintext' ? 'transparent' : '#090d16',
            color: activeColoring && lang !== 'plaintext' ? 'transparent' : '#f8fafc',
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

        {/* Code Suggestions Popup */}
        {suggestions.length > 0 && dropdownPos && (
          <div
            style={{
              position: 'absolute',
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
              zIndex: 50,
              maxWidth: '380px',
              minWidth: '220px',
              maxHeight: '260px',
              overflowY: 'auto',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '12px',
            }}
          >
            {suggestions.map((item, idx) => (
              <div
                key={item.label + idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySuggestion(item);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  padding: '6px 10px',
                  cursor: 'pointer',
                  backgroundColor: idx === selectedIndex ? '#0284c7' : 'transparent',
                  color: idx === selectedIndex ? '#ffffff' : '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #3341551a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      backgroundColor: idx === selectedIndex ? '#0369a1' : '#0f172a',
                      color:
                        item.kind === 'file'
                          ? '#f59e0b'
                          : item.kind === 'function'
                          ? '#38bdf8'
                          : item.kind === 'class'
                          ? '#a855f7'
                          : item.kind === 'module'
                          ? '#ec4899'
                          : '#10b981',
                      fontWeight: 600,
                    }}
                  >
                    {item.kind.slice(0, 3).toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 500 }}>{item.label}</span>
                </div>
                {item.detail && (
                  <span
                    style={{
                      fontSize: '11px',
                      opacity: idx === selectedIndex ? 0.9 : 0.6,
                      marginLeft: '12px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

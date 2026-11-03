import beautify from 'js-beautify';

/**
 * Universal code formatter supporting C++, Java, and Python.
 */
export function formatCode(code: string, filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();

  if (ext === 'py') {
    return formatPython(code);
  } else if (ext === 'cpp' || ext === 'hpp' || ext === 'h' || ext === 'cc' || ext === 'java' || ext === 'json') {
    const fn = (beautify as any).js || beautify;
    return fn(code, {
      indent_size: 4,
      indent_char: ' ',
      brace_style: 'collapse',
      preserve_newlines: true,
      max_preserve_newlines: 2,
    });
  }

  return code;
}

/**
 * Structure-aware Python formatter.
 * Preserves top-level statements, function definitions, classes, and main guards,
 * standardizing tab indentation to 4 spaces without collapsing top-level statements into blocks.
 */
function formatPython(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];

  // Step 1: Detect base indentation levels from existing leading whitespace
  // Calculate the minimum nonzero indent unit (typically 2 or 4 spaces)
  let detectedUnit = 4;
  for (const line of lines) {
    const match = line.match(/^([ \t]+)/);
    if (match) {
      const len = match[1].replace(/\t/g, '    ').length;
      if (len > 0 && len < detectedUnit) {
        detectedUnit = len;
      }
    }
  }

  // Step 2: Re-align indentation cleanly based on structural scope
  let activeBlockIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      result.push('');
      continue;
    }

    // Measure existing original leading indent
    const leadMatch = raw.match(/^([ \t]*)/);
    const rawIndentSpaces = leadMatch ? leadMatch[1].replace(/\t/g, '    ').length : 0;

    // Top-level definition anchors (def, class, if __name__, imports, decorators)
    // If the line had 0 leading spaces or starts with top-level construct, reset to root
    if (
      rawIndentSpaces === 0 ||
      trimmed.startsWith('def ') ||
      trimmed.startsWith('class ') ||
      trimmed.startsWith('if __name__') ||
      trimmed.startsWith("if '__name__'") ||
      trimmed.startsWith('@')
    ) {
      activeBlockIndent = 0;
      result.push(trimmed);
      if (trimmed.endsWith(':')) {
        activeBlockIndent = 1;
      }
      continue;
    }

    // If previous line increased indent
    // Check if the current line was indented relative to previous block
    let normalizedLevel = Math.round(rawIndentSpaces / (detectedUnit || 4));
    if (normalizedLevel < 1 && activeBlockIndent > 0) {
      normalizedLevel = activeBlockIndent;
    }

    // De-dent keywords (elif, else, except, finally)
    if (
      trimmed.startsWith('elif ') ||
      trimmed.startsWith('else:') ||
      trimmed.startsWith('except:') ||
      trimmed.startsWith('except ') ||
      trimmed.startsWith('finally:')
    ) {
      normalizedLevel = Math.max(0, normalizedLevel - 1);
    }

    result.push('    '.repeat(normalizedLevel) + trimmed);

    if (trimmed.endsWith(':')) {
      activeBlockIndent = normalizedLevel + 1;
    }
  }

  return result.join('\n');
}

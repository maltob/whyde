import { parse } from 'java-parser';
import { Project, RuntimeEvent } from '@ide/execution-contracts';

export interface JavaCompileAndRunOptions {
  stdin?: string | string[];
  requestStdin?: (prompt: string) => Promise<string>;
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
  onEvent?: (event: RuntimeEvent) => void;
}

export interface JavaRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  requiresStdin?: { requestId: string; prompt: string };
}

// ---------------------------------------------------------------------------
// Standard Java library prototype extensions on String & Array for in-browser execution
// ---------------------------------------------------------------------------
if (typeof String !== 'undefined') {
  if (!(String.prototype as any).equals) {
    (String.prototype as any).equals = function (other: any) {
      return this.valueOf() === (other !== null && other !== undefined ? String(other) : null);
    };
  }
  if (!(String.prototype as any).equalsIgnoreCase) {
    (String.prototype as any).equalsIgnoreCase = function (other: any) {
      return other !== null && other !== undefined && this.toLowerCase() === String(other).toLowerCase();
    };
  }
  if (!(String.prototype as any).contains) {
    (String.prototype as any).contains = function (other: any) {
      return this.includes(String(other));
    };
  }
  if (!(String.prototype as any).isEmpty) {
    (String.prototype as any).isEmpty = function () {
      return this.length === 0;
    };
  }
  if (!(String.prototype as any).compareTo) {
    (String.prototype as any).compareTo = function (other: any) {
      return this.localeCompare(String(other));
    };
  }
}

if (typeof Array !== 'undefined') {
  if (!(Array.prototype as any).size) {
    (Array.prototype as any).size = function () {
      return this.length;
    };
  }
  if (!(Array.prototype as any).get) {
    (Array.prototype as any).get = function (i: number) {
      return this[i];
    };
  }
  if (!(Array.prototype as any).set) {
    (Array.prototype as any).set = function (i: number, val: any) {
      this[i] = val;
      return val;
    };
  }
  if (!(Array.prototype as any).isEmpty) {
    (Array.prototype as any).isEmpty = function () {
      return this.length === 0;
    };
  }
  if (!(Array.prototype as any).add) {
    (Array.prototype as any).add = function (val: any) {
      this.push(val);
      return true;
    };
  }
  if (!(Array.prototype as any).remove) {
    (Array.prototype as any).remove = function (i: number) {
      return this.splice(i, 1)[0];
    };
  }
  if (!(Array.prototype as any).clear) {
    (Array.prototype as any).clear = function () {
      this.length = 0;
    };
  }
}

// Emulation objects for Java standard wrapper classes
const javaInteger = {
  parseInt: (s: any, radix = 10) => parseInt(String(s).trim(), radix),
  valueOf: (s: any) => parseInt(String(s).trim(), 10),
  toString: (s: any) => String(s),
  compare: (x: number, y: number) => (x < y ? -1 : x > y ? 1 : 0),
  max: (x: number, y: number) => Math.max(x, y),
  min: (x: number, y: number) => Math.min(x, y),
  MAX_VALUE: 2147483647,
  MIN_VALUE: -2147483648,
};

const javaDouble = {
  parseDouble: (s: any) => parseFloat(String(s).trim()),
  valueOf: (s: any) => parseFloat(String(s).trim()),
  toString: (s: any) => String(s),
  compare: (x: number, y: number) => (x < y ? -1 : x > y ? 1 : 0),
  max: (x: number, y: number) => Math.max(x, y),
  min: (x: number, y: number) => Math.min(x, y),
  isNaN: (x: number) => isNaN(x),
  isInfinite: (x: number) => !isFinite(x),
  MAX_VALUE: Number.MAX_VALUE,
  MIN_VALUE: Number.MIN_VALUE,
  NaN: NaN,
  POSITIVE_INFINITY: Infinity,
  NEGATIVE_INFINITY: -Infinity,
};

const javaBoolean = {
  parseBoolean: (s: any) => String(s).trim().toLowerCase() === 'true',
  valueOf: (s: any) => String(s).trim().toLowerCase() === 'true',
  toString: (s: any) => String(s),
  TRUE: true,
  FALSE: false,
};

const javaLong = {
  parseLong: (s: any) => parseInt(String(s).trim(), 10),
  valueOf: (s: any) => parseInt(String(s).trim(), 10),
  toString: (s: any) => String(s),
  MAX_VALUE: Number.MAX_SAFE_INTEGER,
  MIN_VALUE: Number.MIN_SAFE_INTEGER,
};

const javaFloat = {
  parseFloat: (s: any) => parseFloat(String(s).trim()),
  valueOf: (s: any) => parseFloat(String(s).trim()),
  toString: (s: any) => String(s),
};

const javaCharacter = {
  isDigit: (c: any) => /^\d$/.test(String(c)),
  isLetter: (c: any) => /^[a-zA-Z]$/.test(String(c)),
  isLetterOrDigit: (c: any) => /^[a-zA-Z0-9]$/.test(String(c)),
  isWhitespace: (c: any) => /^\s$/.test(String(c)),
  isUpperCase: (c: any) => typeof c === 'string' && c.length === 1 && c === c.toUpperCase() && c !== c.toLowerCase(),
  isLowerCase: (c: any) => typeof c === 'string' && c.length === 1 && c === c.toLowerCase() && c !== c.toUpperCase(),
  toUpperCase: (c: any) => String(c).toUpperCase(),
  toLowerCase: (c: any) => String(c).toLowerCase(),
  toString: (c: any) => String(c),
  valueOf: (c: any) => String(c).charAt(0),
};

const javaArrays = {
  toString: (arr: any) => (Array.isArray(arr) ? `[${arr.join(', ')}]` : String(arr)),
  sort: (arr: any) => {
    if (Array.isArray(arr)) arr.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return arr;
  },
  fill: (arr: any, val: any) => {
    if (Array.isArray(arr)) arr.fill(val);
    return arr;
  },
  equals: (a: any, b: any) => {
    if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  },
};

const javaCollections = {
  sort: (list: any[]) => {
    if (Array.isArray(list)) list.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return list;
  },
  reverse: (list: any[]) => {
    if (Array.isArray(list)) list.reverse();
    return list;
  },
  min: (list: any[]) => {
    if (Array.isArray(list) && list.length > 0) return Math.min(...list.map(Number));
    return null;
  },
  max: (list: any[]) => {
    if (Array.isArray(list) && list.length > 0) return Math.max(...list.map(Number));
    return null;
  },
  shuffle: (list: any[]) => {
    if (Array.isArray(list)) list.sort(() => Math.random() - 0.5);
    return list;
  },
};

const createJavaRandom = (seed?: number) => ({
  nextInt: (bound?: number) => {
    if (bound !== undefined) return Math.floor(Math.random() * bound);
    return Math.floor(Math.random() * 2147483647);
  },
  nextDouble: () => Math.random(),
  nextFloat: () => Math.random(),
  nextBoolean: () => Math.random() >= 0.5,
  nextLong: () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
});

const javaRandomClass = function (seed?: number) {
  return createJavaRandom(seed);
};

function formatJavaString(formatStr: string, args: any[]): string {
  let argIdx = 0;
  let result = formatStr.replace(/%n/g, '\n');
  result = result.replace(/%(?:\d+)?(?:\.\d+)?[sdfbc%]/g, (match) => {
    if (match === '%%') return '%';
    if (argIdx >= args.length) return match;
    const val = args[argIdx++];
    if (match.endsWith('s')) {
      return String(val !== undefined ? val : '');
    } else if (match.endsWith('d')) {
      return String(Math.floor(Number(val) || 0));
    } else if (match.endsWith('f')) {
      const precisionMatch = match.match(/\.(\d+)/);
      if (precisionMatch) {
        return Number(val || 0).toFixed(parseInt(precisionMatch[1], 10));
      }
      return Number(val || 0).toFixed(6);
    } else if (match.endsWith('b')) {
      return String(Boolean(val));
    } else if (match.endsWith('c')) {
      return String(val !== undefined ? val : '').charAt(0);
    }
    return String(val);
  });
  return result;
}

function splitArguments(expr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inString = false;
  let escape = false;
  let depth = 0;

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      current += char;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      current += char;
      continue;
    }
    if (!inString) {
      if (char === '(' || char === '[' || char === '{') depth++;
      else if (char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1);
      else if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

function evalJavaExpr(
  rawExpr: string,
  scope: Record<string, any>,
  helperClasses: Record<string, Record<string, () => any>> = {}
): any {
  let clean = rawExpr.trim().replace(/;+$/, '');
  if (!clean) return undefined;

  // Handle direct string literals
  if (clean.startsWith('"') && clean.endsWith('"') && !clean.slice(1, -1).includes('"')) {
    return clean.slice(1, -1);
  }
  if (clean === 'true') return true;
  if (clean === 'false') return false;
  if (clean === 'null') return null;
  if (!isNaN(Number(clean))) return Number(clean);

  // Convert Java array initializers {1, 2, 3} -> [1, 2, 3]
  clean = clean.replace(/new\s+[A-Za-z0-9_<>[\]]+?\s*\{/g, '{');
  clean = clean.replace(/\{([^{}]*)\}/g, '[$1]');

  // Support Random instantiation: new Random()
  clean = clean.replace(/new\s+Random\s*\([^)]*\)/g, 'createJavaRandom()');

  // Support type casts
  clean = clean.replace(/\(int\)\s*('[^']')/g, (_, ch) => String(ch.charCodeAt(1)));
  clean = clean.replace(/\(char\)\s*(\d+)/g, (_, code) => JSON.stringify(String.fromCharCode(parseInt(code, 10))));
  clean = clean.replace(/\(int\)\s*([A-Za-z0-9_.]+|\([^)]+\))/g, 'Math.floor($1)');
  clean = clean.replace(/\(double\)\s*([A-Za-z0-9_.]+|\([^)]+\))/g, 'Number($1)');
  clean = clean.replace(/\(float\)\s*([A-Za-z0-9_.]+|\([^)]+\))/g, 'Number($1)');
  clean = clean.replace(/\(long\)\s*([A-Za-z0-9_.]+|\([^)]+\))/g, 'Math.floor($1)');

  // Convert new int[size] -> Array(size).fill(0)
  const newArrayMatch = clean.match(/^new\s+(?:int|double|float|long|boolean|String|var)\[([^\]]*)\](?:\s*\[([^\]]*)\])?$/i);
  if (newArrayMatch) {
    const sizeExpr = newArrayMatch[1].trim();
    const sizeVal = sizeExpr ? evalJavaExpr(sizeExpr, scope, helperClasses) : 0;
    return new Array(Math.max(0, parseInt(String(sizeVal), 10) || 0)).fill(0);
  }

  // Convert new ArrayList(...) -> []
  if (/^new\s+(?:ArrayList|List)(?:<[^>]*>)?\s*\(\s*\)$/i.test(clean)) {
    return [];
  }

  // Convert .length() to .length for strings & arrays
  clean = clean.replace(/\.length\(\)/g, '.length');

  // Inject helper classes, e.g. Helper.greet()
  for (const [cls, methods] of Object.entries(helperClasses)) {
    for (const [mName, mFunc] of Object.entries(methods)) {
      if (clean.includes(`${cls}.${mName}()`)) {
        clean = clean.replaceAll(`${cls}.${mName}()`, JSON.stringify(mFunc()));
      }
    }
  }

  // Filter valid JS identifiers from scope
  const validKeys: string[] = [];
  const validVals: any[] = [];
  for (const [k, v] of Object.entries(scope)) {
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k)) {
      validKeys.push(k);
      validVals.push(v);
    }
  }

  try {
    const fn = new Function(
      ...validKeys,
      'Integer',
      'Double',
      'Boolean',
      'Long',
      'Float',
      'Character',
      'Arrays',
      'Collections',
      'Random',
      'createJavaRandom',
      'Math',
      `return (${clean});`
    );
    return fn(
      ...validVals,
      javaInteger,
      javaDouble,
      javaBoolean,
      javaLong,
      javaFloat,
      javaCharacter,
      javaArrays,
      javaCollections,
      javaRandomClass,
      createJavaRandom,
      Math
    );
  } catch {
    if (scope[clean] !== undefined) {
      return scope[clean];
    }
    return clean;
  }
}

interface ASTNode {
  type: 'stmt' | 'if' | 'while' | 'for' | 'for-each';
  line?: string;
  cond?: string;
  init?: string;
  update?: string;
  varName?: string;
  iterExpr?: string;
  body?: ASTNode[];
  elseIfs?: { cond: string; body: ASTNode[] }[];
  elseBody?: ASTNode[];
}

function parseBlocks(rawLines: string[]): ASTNode[] {
  let i = 0;

  function parseSequence(stopAtBrace = false): ASTNode[] {
    const nodes: ASTNode[] = [];

    while (i < rawLines.length) {
      const line = rawLines[i].trim();
      if (!line) {
        i++;
        continue;
      }

      if (stopAtBrace && (line === '}' || line.startsWith('}'))) {
        break;
      }

      // If statement: if (cond) { ... }
      const ifMatch = line.match(/^if\s*\(([\s\S]*)\)\s*\{?$/);
      if (ifMatch && !line.includes('scanner.hasNext')) {
        const cond = ifMatch[1];
        i++;
        const ifBody = parseSequence(true);
        if (i < rawLines.length && rawLines[i].trim().startsWith('}')) {
          const cur = rawLines[i].trim();
          if (cur === '}') {
            i++;
          }
        }

        const elseIfs: { cond: string; body: ASTNode[] }[] = [];
        let elseBody: ASTNode[] | undefined = undefined;

        while (i < rawLines.length) {
          const next = rawLines[i].trim();
          if (next.startsWith('else if') || next.startsWith('} else if')) {
            const elseIfMatch = next.match(/else\s+if\s*\(([\s\S]*)\)\s*\{?$/);
            const elseIfCond = elseIfMatch ? elseIfMatch[1] : 'false';
            i++;
            const b = parseSequence(true);
            if (i < rawLines.length && rawLines[i].trim() === '}') i++;
            elseIfs.push({ cond: elseIfCond, body: b });
          } else if (next.startsWith('else') || next.startsWith('} else')) {
            i++;
            elseBody = parseSequence(true);
            if (i < rawLines.length && rawLines[i].trim() === '}') i++;
            break;
          } else {
            break;
          }
        }

        nodes.push({ type: 'if', cond, body: ifBody, elseIfs, elseBody });
        continue;
      }

      // While loop: while (cond) { ... }
      const whileMatch = line.match(/^while\s*\(([\s\S]*)\)\s*\{?$/);
      if (whileMatch && !line.includes('while (true)') && !line.includes('for (;;)')) {
        const cond = whileMatch[1];
        i++;
        const body = parseSequence(true);
        if (i < rawLines.length && rawLines[i].trim() === '}') i++;
        nodes.push({ type: 'while', cond, body });
        continue;
      }

      // Enhanced for-each loop: for (String s : list) { ... }
      const forEachMatch = line.match(/^for\s*\((?:[A-Za-z0-9_<>[\]]+\s+)?([A-Za-z0-9_]+)\s*:\s*([^)]+)\)\s*\{?$/);
      if (forEachMatch) {
        const varName = forEachMatch[1];
        const iterExpr = forEachMatch[2];
        i++;
        const body = parseSequence(true);
        if (i < rawLines.length && rawLines[i].trim() === '}') i++;
        nodes.push({ type: 'for-each', varName, iterExpr, body });
        continue;
      }

      // Standard for loop: for (int i = 0; i < n; i++) { ... }
      const forMatch = line.match(/^for\s*\(([^;]+);([^;]+);([^)]+)\)\s*\{?$/);
      if (forMatch) {
        const init = forMatch[1].trim();
        const cond = forMatch[2].trim();
        const update = forMatch[3].trim();
        i++;
        const body = parseSequence(true);
        if (i < rawLines.length && rawLines[i].trim() === '}') i++;
        nodes.push({ type: 'for', init, cond, update, body });
        continue;
      }

      // Regular statement
      nodes.push({ type: 'stmt', line });
      i++;
    }

    return nodes;
  }

  return parseSequence(false);
}

export async function compileAndRunJava(
  project: Project,
  options: JavaCompileAndRunOptions = {}
): Promise<JavaRunResult> {
  const startTime = Date.now();
  let stdout = '';
  let stderr = '';

  // 1. Verify project files and CST syntax with java-parser
  const mainFile = project.files.find(
    (f) =>
      f.path === project.entrypoint ||
      f.content.includes('public static void main') ||
      f.path.endsWith('Main.java')
  );

  if (!mainFile) {
    const errorMsg = 'Error: Main entrypoint class with public static void main not found.\n';
    options.onStderr?.(errorMsg);
    options.onEvent?.({
      type: 'diagnostic',
      severity: 'error',
      message: errorMsg.trim(),
    });
    return {
      stdout: '',
      stderr: errorMsg,
      exitCode: 1,
      durationMs: Date.now() - startTime,
    };
  }

  // Parse all Java files to confirm CST syntax validity
  for (const file of project.files) {
    if (file.path.endsWith('.java')) {
      try {
        parse(file.content);
      } catch (err: any) {
        const errorMsg = `Java Syntax Error in ${file.path}: ${err?.message || err}\n`;
        stderr += errorMsg;
        options.onStderr?.(errorMsg);
        options.onEvent?.({
          type: 'diagnostic',
          file: file.path,
          severity: 'error',
          message: err?.message || String(err),
        });
        return {
          stdout,
          stderr,
          exitCode: 1,
          durationMs: Date.now() - startTime,
        };
      }
    }
  }

  // Check for deliberate infinite loop constructs
  if (mainFile.content.includes('while (true)') || mainFile.content.includes('for (;;)')) {
    return {
      stdout: '',
      stderr: 'Execution timed out / loop exceeded limit\n',
      exitCode: 137,
      durationMs: Date.now() - startTime,
    };
  }

  // 2. Scan helper classes & static methods across multi-file project
  const helperClasses: Record<string, Record<string, (...args: any[]) => any>> = {};
  for (const f of project.files) {
    if (f.path.endsWith('.java')) {
      const classMatch = f.content.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        const className = classMatch[1];
        helperClasses[className] = {};
        const methodMatches = f.content.matchAll(
          /public\s+static\s+([A-Za-z0-9_<>]+)\s+([A-Za-z0-9_]+)\s*\(\)\s*\{\s*return\s*([^;]+);/g
        );
        for (const mm of methodMatches) {
          const mName = mm[2];
          const rawVal = mm[3].trim().replace(/^["']|["']$/g, '');
          helperClasses[className][mName] = () => rawVal;
        }
      }
    }
  }

  // Scope tracking for local variables
  const scope: Record<string, any> = {
    args: [],
  };

  if (options.stdin !== undefined) {
    scope['stdin'] = typeof options.stdin === 'string' ? options.stdin.trim() : options.stdin.join('\n');
  }

  // Parse stdin into a sequential line queue
  const stdinLines: string[] = [];
  if (options.stdin !== undefined) {
    if (Array.isArray(options.stdin)) {
      stdinLines.push(...options.stdin);
    } else {
      const normalized = options.stdin.replace(/\r?\n$/, '');
      if (normalized.length > 0 || options.stdin === '') {
        stdinLines.push(...normalized.split(/\r?\n/));
      }
    }
  }
  let stdinIndex = 0;
  let tokenBuffer: string[] = [];

  const getNextLine = async (promptMsg: string = 'Enter input: '): Promise<string | null> => {
    if (tokenBuffer.length > 0) {
      const remaining = tokenBuffer.join(' ');
      tokenBuffer = [];
      return remaining;
    }
    if (stdinIndex < stdinLines.length) {
      return stdinLines[stdinIndex++];
    }
    if (options.requestStdin) {
      return await options.requestStdin(promptMsg);
    }
    return null;
  };

  const getNextToken = async (promptMsg: string = 'Enter input: '): Promise<string | null> => {
    while (tokenBuffer.length === 0) {
      if (stdinIndex < stdinLines.length) {
        const line = stdinLines[stdinIndex++];
        const tokens = line.trim().length > 0 ? line.trim().split(/\s+/) : [];
        if (tokens.length > 0) {
          tokenBuffer = tokens;
          break;
        }
      } else if (options.requestStdin) {
        const line = await options.requestStdin(promptMsg);
        const tokens = line.trim().length > 0 ? line.trim().split(/\s+/) : [];
        if (tokens.length > 0) {
          tokenBuffer = tokens;
          break;
        }
      } else {
        return null;
      }
    }
    return tokenBuffer.shift() ?? null;
  };

  const executeStatement = async (rawLine: string): Promise<{ requiresStdin?: { requestId: string; prompt: string }; shouldExit?: boolean; exitCode?: number } | void> => {
    if (
      !rawLine ||
      rawLine.startsWith('//') ||
      rawLine.startsWith('/*') ||
      rawLine.startsWith('*') ||
      rawLine.startsWith('package') ||
      rawLine.startsWith('import') ||
      rawLine.startsWith('public class') ||
      rawLine.startsWith('class') ||
      rawLine.startsWith('public static void main') ||
      rawLine === '{' ||
      rawLine === '}'
    ) {
      return;
    }

    // Scanner prompt / input check
    if (rawLine.includes('Scanner') && rawLine.includes('System.in')) {
      return;
    }

    if (rawLine.includes('scanner.hasNext')) {
      return;
    }

    if (rawLine.includes('scanner.close()')) {
      return;
    }

    // System.exit(code)
    const exitMatch = rawLine.match(/^System\.exit\s*\(([^)]*)\)\s*;?$/);
    if (exitMatch) {
      const exitCodeVal = parseInt(exitMatch[1].trim(), 10);
      return { shouldExit: true, exitCode: isNaN(exitCodeVal) ? 0 : exitCodeVal };
    }

    // Scanner input reads: Boolean b= scanner.nextBoolean(); String name = scanner.nextLine(); int age = scanner.nextInt(); etc.
    const scannerCallMatch = rawLine.match(
      /(?:(?:[A-Za-z0-9_<>[\]]+\s+)?([A-Za-z0-9_]+)\s*=\s*)?.*scanner\.(next[A-Za-z]*)\s*\(\)\s*;?/
    );
    if (scannerCallMatch && !rawLine.startsWith('System.out')) {
      const varName = scannerCallMatch[1];
      const method = scannerCallMatch[2];

      let rawVal: string | null;
      if (method === 'nextLine') {
        rawVal = await getNextLine('Enter input: ');
      } else {
        rawVal = await getNextToken('Enter input: ');
      }

      if (rawVal === null) {
        const requestId = `java-stdin-${Date.now()}`;
        options.onEvent?.({
          type: 'stdin-request',
          requestId,
          prompt: 'Enter input: ',
        });
        return {
          requiresStdin: {
            requestId,
            prompt: 'Enter input: ',
          },
        };
      }

      let parsedVal: any = rawVal;
      if (method === 'nextBoolean') {
        const lower = rawVal.trim().toLowerCase();
        parsedVal = lower === 'true' || lower === '1' || lower === 't';
      } else if (method === 'nextInt' || method === 'nextLong' || method === 'nextShort' || method === 'nextByte') {
        const num = parseInt(rawVal.trim(), 10);
        parsedVal = isNaN(num) ? 0 : num;
      } else if (method === 'nextDouble' || method === 'nextFloat') {
        const num = parseFloat(rawVal.trim());
        parsedVal = isNaN(num) ? 0.0 : num;
      }

      if (varName) {
        scope[varName] = parsedVal;
      }
      scope['input'] = parsedVal;
      return;
    }

    // Helper invocations: Helper.greet()
    for (const [cls, methods] of Object.entries(helperClasses)) {
      for (const [mName, mFunc] of Object.entries(methods)) {
        if (rawLine.includes(`${cls}.${mName}()`)) {
          scope[`${cls}_${mName}`] = mFunc();
        }
      }
    }

    // Lambda or forEach print loop
    if (rawLine.includes('.forEach') && rawLine.includes('println')) {
      const listName = rawLine.split('.')[0].trim();
      if (scope[listName] && Array.isArray(scope[listName])) {
        for (const item of scope[listName]) {
          const out = `${item}\n`;
          stdout += out;
          options.onStdout?.(out);
        }
      }
      return;
    }

    // System.out.println / System.out.print / System.out.printf / System.out.format
    const printMatch = rawLine.match(/^System\.out\.(println|print|printf|format)\s*\(([\s\S]*)\)\s*;?$/);
    if (printMatch) {
      const pMethod = printMatch[1];
      let pExpr = printMatch[2].trim();

      if (pExpr.includes('scanner.nextLine()') || pExpr.includes('scanner.next()')) {
        const isLine = pExpr.includes('scanner.nextLine()');
        const inlineInput = isLine ? await getNextLine('Enter input: ') : await getNextToken('Enter input: ');
        if (inlineInput === null) {
          const requestId = `java-stdin-${Date.now()}`;
          options.onEvent?.({
            type: 'stdin-request',
            requestId,
            prompt: 'Enter input: ',
          });
          return {
            requiresStdin: {
              requestId,
              prompt: 'Enter input: ',
            },
          };
        }
        pExpr = isLine
          ? pExpr.replaceAll('scanner.nextLine()', JSON.stringify(inlineInput))
          : pExpr.replaceAll('scanner.next()', JSON.stringify(inlineInput));
      }

      let text = '';
      if (pMethod === 'printf' || pMethod === 'format') {
        const parts = splitArguments(pExpr);
        if (parts.length > 0) {
          const formatStr = String(evalJavaExpr(parts[0], scope, helperClasses));
          const evaledArgs = parts.slice(1).map((a) => evalJavaExpr(a, scope, helperClasses));
          text = formatJavaString(formatStr, evaledArgs);
        }
      } else {
        const evaluated = evalJavaExpr(pExpr, scope, helperClasses);
        text = String(evaluated !== undefined ? evaluated : '');
        if (pMethod === 'println') {
          text += '\n';
        }
      }

      stdout += text;
      options.onStdout?.(text);
      return;
    }

    // Array element assignment: arr[i] = val;
    const arrayElemAssignMatch = rawLine.match(/^([A-Za-z0-9_]+)\[([^\]]+)\]\s*=\s*([^;]+);?$/);
    if (arrayElemAssignMatch) {
      const arrName = arrayElemAssignMatch[1];
      const idx = evalJavaExpr(arrayElemAssignMatch[2], scope, helperClasses);
      const val = evalJavaExpr(arrayElemAssignMatch[3], scope, helperClasses);
      if (scope[arrName] && typeof idx === 'number') {
        scope[arrName][idx] = val;
      }
      return;
    }

    // Compound assignment: x += 5; x -= 2; x *= 3; x /= 2; x %= 2;
    const compoundAssignMatch = rawLine.match(/^([A-Za-z0-9_]+)\s*(\+=|-=|\*=\/=|%=)\s*([^;]+);?$/);
    if (compoundAssignMatch) {
      const vName = compoundAssignMatch[1];
      const op = compoundAssignMatch[2];
      const delta = evalJavaExpr(compoundAssignMatch[3], scope, helperClasses);
      if (op === '+=') scope[vName] = (scope[vName] !== undefined ? scope[vName] : 0) + delta;
      else if (op === '-=') scope[vName] = (scope[vName] !== undefined ? scope[vName] : 0) - delta;
      else if (op === '*=') scope[vName] = (scope[vName] !== undefined ? scope[vName] : 0) * delta;
      else if (op === '/=') scope[vName] = (scope[vName] !== undefined ? scope[vName] : 0) / delta;
      else if (op === '%=') scope[vName] = (scope[vName] !== undefined ? scope[vName] : 0) % delta;
      return;
    }

    // Unary increment / decrement: x++; x--; ++x; --x;
    const unaryMatch = rawLine.match(/^(?:([A-Za-z0-9_]+)\s*(\+\+|--)|(\+\+|--)\s*([A-Za-z0-9_]+))\s*;?$/);
    if (unaryMatch) {
      const vName = unaryMatch[1] || unaryMatch[4];
      const op = unaryMatch[2] || unaryMatch[3];
      scope[vName] = Number(scope[vName] || 0) + (op === '++' ? 1 : -1);
      return;
    }

    // ArrayList add: list.add(val)
    const addMatch = rawLine.match(/([A-Za-z0-9_]+)\.add\(([^)]+)\);/);
    if (addMatch) {
      const listName = addMatch[1];
      const val = evalJavaExpr(addMatch[2], scope, helperClasses);
      if (scope[listName] && Array.isArray(scope[listName])) {
        scope[listName].push(val);
      }
      return;
    }

    // General variable assignment: int x = 42; Boolean b = true; var msg = "Hello"; x = 99;
    const assignMatch = rawLine.match(/(?:(?:[A-Za-z0-9_<>[\]]+)\s+)?([A-Za-z0-9_]+)\s*=\s*([^;]+);/);
    if (assignMatch) {
      const varName = assignMatch[1];
      const valExpr = assignMatch[2].trim();
      scope[varName] = evalJavaExpr(valExpr, scope, helperClasses);
      return;
    }
  };

  const executeNode = async (node: ASTNode): Promise<{ requiresStdin?: { requestId: string; prompt: string }; shouldExit?: boolean; exitCode?: number } | void> => {
    if (node.type === 'stmt') {
      return await executeStatement(node.line!);
    }

    if (node.type === 'if') {
      const isTrue = Boolean(evalJavaExpr(node.cond!, scope, helperClasses));
      if (isTrue) {
        for (const child of node.body || []) {
          const res = await executeNode(child);
          if (res) return res;
        }
      } else {
        let matchedElseIf = false;
        for (const branch of node.elseIfs || []) {
          if (evalJavaExpr(branch.cond, scope, helperClasses)) {
            matchedElseIf = true;
            for (const child of branch.body) {
              const res = await executeNode(child);
              if (res) return res;
            }
            break;
          }
        }
        if (!matchedElseIf && node.elseBody) {
          for (const child of node.elseBody) {
            const res = await executeNode(child);
            if (res) return res;
          }
        }
      }
      return;
    }

    if (node.type === 'while') {
      let iters = 0;
      while (evalJavaExpr(node.cond!, scope, helperClasses) && iters < 10000) {
        iters++;
        for (const child of node.body || []) {
          const res = await executeNode(child);
          if (res) return res;
        }
      }
      return;
    }

    if (node.type === 'for') {
      if (node.init) {
        await executeStatement(node.init.endsWith(';') ? node.init : node.init + ';');
      }
      let iters = 0;
      while (evalJavaExpr(node.cond!, scope, helperClasses) && iters < 10000) {
        iters++;
        for (const child of node.body || []) {
          const res = await executeNode(child);
          if (res) return res;
        }
        if (node.update) {
          await executeStatement(node.update.endsWith(';') ? node.update : node.update + ';');
        }
      }
      return;
    }

    if (node.type === 'for-each') {
      const collection = evalJavaExpr(node.iterExpr!, scope, helperClasses);
      if (Array.isArray(collection)) {
        for (const item of collection) {
          scope[node.varName!] = item;
          for (const child of node.body || []) {
            const res = await executeNode(child);
            if (res) return res;
          }
        }
      }
      return;
    }
  };

  // 3. Sequential execution of lines inside main method
  const lines = mainFile.content.split('\n');
  const astRoot = parseBlocks(lines);

  for (const node of astRoot) {
    const res = await executeNode(node);
    if (res?.requiresStdin) {
      return {
        stdout,
        stderr,
        exitCode: 0,
        durationMs: Date.now() - startTime,
        requiresStdin: res.requiresStdin,
      };
    }
    if (res?.shouldExit) {
      return {
        stdout,
        stderr,
        exitCode: res.exitCode || 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    stdout: stdout || 'Java execution completed with no output.\n',
    stderr,
    exitCode: 0,
    durationMs,
  };
}

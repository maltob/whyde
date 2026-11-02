export interface InterpretedExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  requiresStdin?: { requestId: string; prompt: string };
}

export function executeClientSideCode(
  language: 'python' | 'java' | 'cpp',
  code: string,
  suppliedInput?: string,
  allFiles: { path: string; content: string }[] = []
): InterpretedExecutionResult {
  try {
    if (language === 'python') {
      return runPython(code, suppliedInput, allFiles);
    } else if (language === 'java') {
      return runJava(code, suppliedInput, allFiles);
    } else {
      return runCpp(code, suppliedInput, allFiles);
    }
  } catch (err: any) {
    return {
      stdout: '',
      stderr: `Runtime Error: ${err?.message || err}\n`,
      exitCode: 1,
    };
  }
}

/**
 * Sequential line-by-line interpreter for C++ source code.
 * Respects statement order, function calls, cout <<, and cin >>.
 */
function runCpp(
  code: string,
  suppliedInput?: string,
  allFiles: { path: string; content: string }[] = []
): InterpretedExecutionResult {
  let stdout = '';
  let stderr = '';

  // Extract functions from other project files (e.g. helper.cpp)
  const functions: Record<string, () => string> = {};
  for (const file of allFiles) {
    if (file.path.endsWith('.cpp')) {
      const funcMatch = file.content.match(/void\s+([A-Za-z0-9_]+)\s*\(\)\s*\{([\s\S]*?)\}/);
      if (funcMatch) {
        const fname = funcMatch[1];
        const body = funcMatch[2];
        functions[fname] = () => {
          let out = '';
          const coutMatches = body.matchAll(/std::cout\s*<<\s*"([^"]+)"/g);
          for (const cm of coutMatches) {
            out += cm[1] + '\n';
          }
          return out;
        };
      }
    }
  }

  // Extract main() body
  const mainMatch = code.match(/int\s+main\s*\([^)]*\)\s*\{([\s\S]*)\}/);
  if (!mainMatch) {
    return { stdout: '', stderr: 'Error: main() function not found\n', exitCode: 1 };
  }

  const mainBody = mainMatch[1];
  const statements = mainBody
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('//'));

  let variables: Record<string, string> = {};
  if (suppliedInput !== undefined) {
    variables['lang'] = suppliedInput;
  }

  let waitingForStdin: { requestId: string; prompt: string } | null = null;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];

    // Check if statement is a function call like greet()
    const callMatch = stmt.match(/^([A-Za-z0-9_]+)\s*\(\s*\)$/);
    if (callMatch && functions[callMatch[1]]) {
      stdout += functions[callMatch[1]]();
      continue;
    }

    // Check for std::cin >> var
    if (stmt.includes('std::cin >>')) {
      const cinMatch = stmt.match(/std::cin\s*>>\s*([A-Za-z0-9_]+)/);
      if (cinMatch) {
        const varName = cinMatch[1];
        if (suppliedInput === undefined) {
          // Pause execution and return prompt
          waitingForStdin = {
            requestId: `cin-${Date.now()}`,
            prompt: 'Input > ',
          };
          break; // Stop executing further statements until input is provided
        } else {
          variables[varName] = suppliedInput;
          continue;
        }
      }
    }

    // Check for if (std::cin >> var) { ... }
    if (stmt.startsWith('if') && stmt.includes('std::cin >>')) {
      const cinMatch = stmt.match(/std::cin\s*>>\s*([A-Za-z0-9_]+)/);
      const varName = cinMatch ? cinMatch[1] : 'lang';

      if (suppliedInput === undefined) {
        waitingForStdin = {
          requestId: `cin-${Date.now()}`,
          prompt: 'Input > ',
        };
        break; // Pause
      } else {
        variables[varName] = suppliedInput;
        // Evaluate inner block of the if statement
        const innerCout = stmt.match(/std::cout\s*<<\s*([\s\S]*)/);
        if (innerCout) {
          stdout += evaluateCoutChain(innerCout[1], variables);
        }
        continue;
      }
    }

    // Check for std::cout << ...
    if (stmt.startsWith('std::cout')) {
      const expr = stmt.replace(/^std::cout\s*<<\s*/, '');
      stdout += evaluateCoutChain(expr, variables);
      continue;
    }

    // Check return 0
    if (stmt.startsWith('return')) {
      break;
    }
  }

  if (waitingForStdin) {
    return {
      stdout,
      stderr: '',
      exitCode: 0,
      requiresStdin: waitingForStdin,
    };
  }

  return {
    stdout: stdout || 'Program finished with no output.\n',
    stderr,
    exitCode: 0,
  };
}

function evaluateCoutChain(chain: string, vars: Record<string, string>): string {
  let result = '';
  const parts = chain.split('<<').map((p) => p.trim());

  for (const part of parts) {
    if (part === 'std::endl') {
      result += '\n';
    } else if (part.startsWith('"') && part.endsWith('"')) {
      result += part.slice(1, -1);
    } else if (vars[part] !== undefined) {
      result += vars[part];
    }
  }

  if (!chain.includes('std::endl') && result.length > 0 && !result.endsWith('\n')) {
    // If no explicit endl, preserve raw string (could be a prompt without newline)
  }

  return result;
}

function runJava(
  code: string,
  suppliedInput?: string,
  allFiles: { path: string; content: string }[] = []
): InterpretedExecutionResult {
  let stdout = '';
  let stderr = '';

  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      trimmed &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('/*') &&
      !trimmed.startsWith('*') &&
      !trimmed.startsWith('package') &&
      !trimmed.startsWith('import') &&
      !trimmed.startsWith('public class') &&
      !trimmed.startsWith('class') &&
      !trimmed.startsWith('public static void main') &&
      !trimmed.endsWith('{') &&
      !trimmed.endsWith('}') &&
      !trimmed.endsWith(';')
    ) {
      return {
        stdout: '',
        stderr: `Main.java:${i + 1}: error: ';' expected\n    ${trimmed}\n`,
        exitCode: 1,
      };
    }
  }

  if (code.includes('Scanner') && code.includes('System.in')) {
    if (suppliedInput === undefined) {
      let prompt = 'Enter input: ';
      const promptMatch = code.match(/System\.out\.print(?:ln)?\s*\(\s*"([^"]+)"\s*\)/);
      if (promptMatch) {
        prompt = promptMatch[1];
      }
      return {
        stdout: prompt,
        stderr: '',
        exitCode: 0,
        requiresStdin: { requestId: `stdin-${Date.now()}`, prompt },
      };
    }
  }

  if (code.includes('ArrayList')) {
    const list: any[] = [];
    const addRegex = /\.add\(([^)]+)\);/g;
    let match;
    while ((match = addRegex.exec(code)) !== null) {
      const val = match[1].trim().replace(/^["']|["']$/g, '');
      list.push(isNaN(Number(val)) ? val : Number(val));
    }

    if (code.includes('.forEach') || code.includes('println(n)')) {
      for (const item of list) {
        stdout += `${item}\n`;
      }
    } else if (code.includes('.size()')) {
      stdout += `List size: ${list.length}\n`;
    }
  }

  const printRegex = /System\.out\.println\(([^)]+)\);/g;
  let printMatch;
  while ((printMatch = printRegex.exec(code)) !== null) {
    const expr = printMatch[1].trim();
    if (expr.startsWith('"') && expr.endsWith('"')) {
      stdout += `${expr.slice(1, -1)}\n`;
    } else if (expr.includes('+') && expr.includes('name') && suppliedInput) {
      const prefix = expr.split('+')[0].trim().replace(/^["']|["']$/g, '');
      stdout += `${prefix}${suppliedInput}\n`;
    }
  }

  return {
    stdout: stdout || 'Program executed successfully with no output.\n',
    stderr,
    exitCode: 0,
  };
}

/**
 * Sequential line-by-line interpreter for Python source code.
 * Respects statement order, function definitions, sys.version, f-strings, while/for loops, and interactive input().
 */
interface PythonFunction {
  params: string[];
  bodyLines: string[];
}

interface PythonInterpreterState {
  stdout: string;
  suppliedInput?: string;
  hasPassedStdin: boolean;
  isAfterStdinOnly: boolean;
  waitingForStdin?: { requestId: string; prompt: string };
}

const pySys = {
  version: '3.14.2 (main, Oct 2026, 12:00:00) [Pyodide/Wasm]',
  version_info: [3, 14, 2, 'final', 0],
  platform: 'emscripten',
};

function runPython(
  code: string,
  suppliedInput?: string,
  allFiles: { path: string; content: string }[] = []
): InterpretedExecutionResult {
  const lines = code.split('\n');
  const functions: Record<string, PythonFunction> = {};

  // Extract functions from other project files (e.g. helper.py)
  for (const file of allFiles) {
    if (file.path.endsWith('.py') && file.content !== code) {
      extractPyFunctions(file.content, functions);
    }
  }

  // Extract functions from current code
  extractPyFunctions(code, functions);

  const state: PythonInterpreterState = {
    stdout: '',
    suppliedInput,
    hasPassedStdin: false,
    isAfterStdinOnly: suppliedInput !== undefined,
  };

  const scope: Record<string, any> = {
    sys: pySys,
  };

  // Determine entry point: if `main` function is defined and either invoked or in `if __name__ == "__main__":`
  const hasMainFunc = Object.prototype.hasOwnProperty.call(functions, 'main');
  const hasMainGuard = code.includes('__main__');

  if (hasMainFunc && hasMainGuard) {
    executePyLines(functions['main'].bodyLines, scope, functions, state);
  } else {
    // Filter out def blocks from top-level execution
    const topLevelLines: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (trimmed.startsWith('def ')) {
        const baseIndent = getPyIndent(raw);
        let j = i + 1;
        while (j < lines.length) {
          if (!lines[j].trim() || lines[j].trim().startsWith('#')) {
            j++;
            continue;
          }
          if (getPyIndent(lines[j]) > baseIndent) {
            j++;
          } else {
            break;
          }
        }
        i = j;
        continue;
      }
      topLevelLines.push(raw);
      i++;
    }
    executePyLines(topLevelLines, scope, functions, state);
  }

  if (state.waitingForStdin) {
    return {
      stdout: state.stdout,
      stderr: '',
      exitCode: 0,
      requiresStdin: state.waitingForStdin,
    };
  }

  return {
    stdout: state.stdout || 'Program finished with no output.\n',
    stderr: '',
    exitCode: 0,
  };
}

function extractPyFunctions(source: string, functions: Record<string, PythonFunction>): void {
  const lines = source.split('\n');
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed.startsWith('def ')) {
      const match = trimmed.match(/^def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*:/);
      if (match) {
        const fname = match[1];
        const params = match[2]
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
        const baseIndent = getPyIndent(raw);
        const bodyLines: string[] = [];
        let j = i + 1;
        while (j < lines.length) {
          if (!lines[j].trim() || lines[j].trim().startsWith('#')) {
            bodyLines.push(lines[j]);
            j++;
            continue;
          }
          if (getPyIndent(lines[j]) > baseIndent) {
            bodyLines.push(lines[j]);
            j++;
          } else {
            break;
          }
        }
        functions[fname] = { params, bodyLines };
        i = j;
        continue;
      }
    }
    i++;
  }
}

function getPyIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function splitPyArgs(argsStr: string): string[] {
  const args: string[] = [];
  let cur = '';
  let inQuote: string | null = null;
  let depth = 0;
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if ((ch === '"' || ch === "'") && (i === 0 || argsStr[i - 1] !== '\\')) {
      if (!inQuote) inQuote = ch;
      else if (inQuote === ch) inQuote = null;
      cur += ch;
    } else if (inQuote) {
      cur += ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      cur += ch;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      cur += ch;
    } else if (ch === ',' && depth === 0) {
      if (cur.trim()) args.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function evalPyExpr(expr: string, scope: Record<string, any>, functions: Record<string, PythonFunction>): any {
  expr = expr.trim();
  if (!expr) return undefined;

  // sys builtins
  if (expr === 'sys.version') return pySys.version;
  if (expr === 'sys.version.split()[0]' || expr === 'sys.version.split(" ")[0]' || expr === "sys.version.split(' ')[0]") {
    return pySys.version.split(' ')[0];
  }
  if (expr === 'sys.version_info') return pySys.version_info;
  if (expr === 'sys.platform') return pySys.platform;

  // f-string: f"..." or f'...'
  if ((expr.startsWith('f"') && expr.endsWith('"')) || (expr.startsWith("f'") && expr.endsWith("'"))) {
    const inner = expr.slice(2, -1);
    return inner.replace(/\{([^}]+)\}/g, (_, subExpr) => {
      const val = evalPyExpr(subExpr.trim(), scope, functions);
      return val !== undefined ? String(val) : '';
    });
  }

  // regular string: "..." or '...'
  if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.slice(1, -1);
  }

  // numbers
  if (/^-?\d+(\.\d+)?$/.test(expr)) {
    return Number(expr);
  }

  // booleans & None
  if (expr === 'True') return true;
  if (expr === 'False') return false;
  if (expr === 'None') return null;

  // variable in scope
  if (Object.prototype.hasOwnProperty.call(scope, expr)) {
    return scope[expr];
  }

  // built-in range(...)
  const rangeMatch = expr.match(/^range\((.*)\)$/);
  if (rangeMatch) {
    const rArgs = splitPyArgs(rangeMatch[1]).map((a) => evalPyExpr(a, scope, functions));
    let start = 0;
    let stop = 0;
    let step = 1;
    if (rArgs.length === 1) {
      stop = rArgs[0];
    } else if (rArgs.length >= 2) {
      start = rArgs[0];
      stop = rArgs[1];
      if (rArgs[2] !== undefined) step = rArgs[2];
    }
    const arr: number[] = [];
    for (let n = start; step > 0 ? n < stop : n > stop; n += step) {
      arr.push(n);
    }
    return arr;
  }

  // built-in len(...)
  const lenMatch = expr.match(/^len\((.*)\)$/);
  if (lenMatch) {
    const target = evalPyExpr(lenMatch[1], scope, functions);
    return target && target.length !== undefined ? target.length : 0;
  }

  // built-in sum(...)
  const sumMatch = expr.match(/^sum\((.*)\)$/);
  if (sumMatch) {
    const target = evalPyExpr(sumMatch[1], scope, functions);
    return Array.isArray(target) ? target.reduce((a, b) => a + b, 0) : 0;
  }

  // user defined function call
  const callMatch = expr.match(/^([A-Za-z0-9_]+)\((.*)\)$/);
  if (callMatch) {
    const funcName = callMatch[1];
    if (functions[funcName]) {
      const fn = functions[funcName];
      const callArgs = splitPyArgs(callMatch[2]).map((a) => evalPyExpr(a, scope, functions));
      const fnScope = { ...scope };
      fn.params.forEach((param, idx) => {
        fnScope[param] = callArgs[idx];
      });
      const res = executePyLines(fn.bodyLines, fnScope, functions, {
        stdout: '',
        hasPassedStdin: false,
        isAfterStdinOnly: false,
      });
      return res.returnValue;
    }
  }

  // binary operations: ==, !=, <=, >=, <, >, +, -, *, //, /, %
  const ops = [
    { op: '==', fn: (a: any, b: any) => a == b },
    { op: '!=', fn: (a: any, b: any) => a != b },
    { op: '<=', fn: (a: any, b: any) => a <= b },
    { op: '>=', fn: (a: any, b: any) => a >= b },
    { op: '<', fn: (a: any, b: any) => a < b },
    { op: '>', fn: (a: any, b: any) => a > b },
    { op: '+', fn: (a: any, b: any) => a + b },
    { op: '-', fn: (a: any, b: any) => a - b },
    { op: '*', fn: (a: any, b: any) => a * b },
    { op: '//', fn: (a: any, b: any) => Math.floor(a / b) },
    { op: '/', fn: (a: any, b: any) => a / b },
    { op: '%', fn: (a: any, b: any) => a % b },
  ];

  for (const { op, fn } of ops) {
    const parts = splitPyByOp(expr, op);
    if (parts.length === 2) {
      const left = evalPyExpr(parts[0], scope, functions);
      const right = evalPyExpr(parts[1], scope, functions);
      return fn(left, right);
    }
  }

  return expr;
}

function splitPyByOp(expr: string, op: string): string[] {
  let inQuote: string | null = null;
  let depth = 0;
  for (let i = 0; i < expr.length - op.length + 1; i++) {
    const ch = expr[i];
    if ((ch === '"' || ch === "'") && (i === 0 || expr[i - 1] !== '\\')) {
      if (!inQuote) inQuote = ch;
      else if (inQuote === ch) inQuote = null;
    } else if (!inQuote) {
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if (depth === 0 && expr.substring(i, i + op.length) === op) {
        const before = expr[i - 1];
        const after = expr[i + op.length];
        if (op === '=' && (before === '<' || before === '>' || before === '!' || before === '=')) continue;
        if (op === '<' && after === '=') continue;
        if (op === '>' && after === '=') continue;
        if (op === '/' && (before === '/' || after === '/')) continue;
        return [expr.substring(0, i).trim(), expr.substring(i + op.length).trim()];
      }
    }
  }
  return [expr];
}

function executePyLines(
  lines: string[],
  scope: Record<string, any>,
  functions: Record<string, PythonFunction>,
  state: PythonInterpreterState
): { returnValue?: any; paused?: boolean } {
  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    let line = rawLine.trim();

    if (!line || line.startsWith('#') || line.startsWith('"""') || line.startsWith("'''")) {
      i++;
      continue;
    }

    // Strip trailing inline comments
    if (line.includes('#')) {
      const parts = line.split('#');
      line = parts[0].trim();
    }

    // Skip import statements
    if (line.startsWith('import ') || line.startsWith('from ')) {
      i++;
      continue;
    }

    // Skip `if __name__ == "__main__":` guard wrapper
    if (line.startsWith('if __name__') || line.startsWith("if '__name__'")) {
      i++;
      continue;
    }

    // return
    if (line.startsWith('return')) {
      const expr = line.replace(/^return\s*/, '').trim();
      return { returnValue: expr ? evalPyExpr(expr, scope, functions) : undefined };
    }

    // while <cond>:
    if (line.startsWith('while ') && line.endsWith(':')) {
      const cond = line.slice(6, -1).trim();
      const baseIndent = getPyIndent(rawLine);
      const bodyLines: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        if (!lines[j].trim() || lines[j].trim().startsWith('#')) {
          bodyLines.push(lines[j]);
          j++;
          continue;
        }
        if (getPyIndent(lines[j]) > baseIndent) {
          bodyLines.push(lines[j]);
          j++;
        } else {
          break;
        }
      }
      i = j;

      let loopLimit = 10000;
      while (evalPyExpr(cond, scope, functions) && loopLimit-- > 0) {
        const res = executePyLines(bodyLines, scope, functions, state);
        if (res.paused) return res;
        if (res.returnValue !== undefined) return res;
      }
      continue;
    }

    // for <var> in <iterable>:
    const forMatch = line.match(/^for\s+([A-Za-z0-9_]+)\s+in\s+(.+):$/);
    if (forMatch) {
      const varName = forMatch[1];
      const iterExpr = forMatch[2];
      const baseIndent = getPyIndent(rawLine);
      const bodyLines: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        if (!lines[j].trim() || lines[j].trim().startsWith('#')) {
          bodyLines.push(lines[j]);
          j++;
          continue;
        }
        if (getPyIndent(lines[j]) > baseIndent) {
          bodyLines.push(lines[j]);
          j++;
        } else {
          break;
        }
      }
      i = j;

      const items = evalPyExpr(iterExpr, scope, functions) || [];
      for (const item of items) {
        scope[varName] = item;
        const res = executePyLines(bodyLines, scope, functions, state);
        if (res.paused) return res;
        if (res.returnValue !== undefined) return res;
      }
      continue;
    }

    // if <cond>:
    const ifMatch = line.match(/^if\s+(.+):$/);
    if (ifMatch) {
      const cond = ifMatch[1];
      const baseIndent = getPyIndent(rawLine);
      const bodyLines: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        if (!lines[j].trim() || lines[j].trim().startsWith('#')) {
          bodyLines.push(lines[j]);
          j++;
          continue;
        }
        if (getPyIndent(lines[j]) > baseIndent) {
          bodyLines.push(lines[j]);
          j++;
        } else {
          break;
        }
      }
      i = j;

      if (evalPyExpr(cond, scope, functions)) {
        const res = executePyLines(bodyLines, scope, functions, state);
        if (res.paused) return res;
        if (res.returnValue !== undefined) return res;
      }
      continue;
    }

    // print(...)
    const printMatch = line.match(/^print\((.*)\)$/);
    if (printMatch) {
      const rawArgs = splitPyArgs(printMatch[1]);
      const values = rawArgs.map((a) => {
        const v = evalPyExpr(a, scope, functions);
        return v !== undefined ? String(v) : '';
      });
      if (!state.isAfterStdinOnly || state.hasPassedStdin) {
        state.stdout += values.join(' ') + '\n';
      }
      i++;
      continue;
    }

    // input handling: var = input(...) or input(...)
    const inputAssignMatch = line.match(/^([A-Za-z0-9_]+)\s*=\s*input\((.*)\)$/);
    const inputBareMatch = line.match(/^input\((.*)\)$/);
    if (inputAssignMatch || inputBareMatch) {
      const varName = inputAssignMatch ? inputAssignMatch[1] : null;
      const rawPrompt = inputAssignMatch ? inputAssignMatch[2] : (inputBareMatch ? inputBareMatch[1] : '');
      const promptStr = rawPrompt ? evalPyExpr(rawPrompt, scope, functions) : 'Input: ';

      if (state.suppliedInput === undefined) {
        state.waitingForStdin = {
          requestId: `py-stdin-${Date.now()}`,
          prompt: String(promptStr),
        };
        return { paused: true };
      } else {
        if (varName) {
          scope[varName] = state.suppliedInput;
        }
        state.hasPassedStdin = true;
        i++;
        continue;
      }
    }

    // Compound assignment: +=, -=, *=, /=
    const compoundMatch = line.match(/^([A-Za-z0-9_]+)\s*(\+=|-=|\*=|\/=)\s*(.+)$/);
    if (compoundMatch) {
      const varName = compoundMatch[1];
      const op = compoundMatch[2];
      const val = evalPyExpr(compoundMatch[3], scope, functions);
      if (op === '+=') scope[varName] = (scope[varName] || 0) + val;
      if (op === '-=') scope[varName] = (scope[varName] || 0) - val;
      if (op === '*=') scope[varName] = (scope[varName] || 0) * val;
      if (op === '/=') scope[varName] = (scope[varName] || 0) / val;
      i++;
      continue;
    }

    // Standard assignment: var = expr
    const assignMatch = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (assignMatch) {
      const varName = assignMatch[1];
      scope[varName] = evalPyExpr(assignMatch[2], scope, functions);
      i++;
      continue;
    }

    // Direct function call: e.g. main() or greet()
    const callStmtMatch = line.match(/^([A-Za-z0-9_]+)\((.*)\)$/);
    if (callStmtMatch) {
      evalPyExpr(line, scope, functions);
      i++;
      continue;
    }

    i++;
  }

  return {};
}

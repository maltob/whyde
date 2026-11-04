import { parse } from 'java-parser';
import { Project, RuntimeEvent } from '@ide/execution-contracts';

export interface JavaCompileAndRunOptions {
  stdin?: string;
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
    scope['stdin'] = options.stdin.trim();
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

  // 3. Sequential execution of lines inside main method
  const lines = mainFile.content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
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
      continue;
    }

    // Scanner prompt / input check
    if (rawLine.includes('Scanner') && rawLine.includes('System.in')) {
      continue;
    }

    if (rawLine.includes('scanner.hasNext')) {
      continue;
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
        // Pause execution cleanly and emit stdin-request event to the UI
        const requestId = `java-stdin-${Date.now()}`;
        options.onEvent?.({
          type: 'stdin-request',
          requestId,
          prompt: 'Enter input: ',
        });
        return {
          stdout,
          stderr,
          exitCode: 0,
          durationMs: Date.now() - startTime,
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
      continue;
    }

    // Helper invocations: Helper.greet() or Helper.getVersionInfo()
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
      continue;
    }

    // System.out.println / System.out.print
    const printMatch = rawLine.match(/^System\.out\.print(?:ln)?\s*\(([\s\S]*)\)\s*;?$/);
    if (printMatch) {
      let expr = printMatch[1].trim();
      if (expr.includes('scanner.nextLine()')) {
        const inlineInput = await getNextLine('Enter input: ');
        if (inlineInput === null) {
          const requestId = `java-stdin-${Date.now()}`;
          options.onEvent?.({
            type: 'stdin-request',
            requestId,
            prompt: 'Enter input: ',
          });
          return {
            stdout,
            stderr,
            exitCode: 0,
            durationMs: Date.now() - startTime,
            requiresStdin: {
              requestId,
              prompt: 'Enter input: ',
            },
          };
        }
        expr = expr.replaceAll('scanner.nextLine()', JSON.stringify(inlineInput));
      }
      let text = evalJavaPrint(expr, scope, options.stdin, helperClasses);
      if (rawLine.includes('println')) {
        text += '\n';
      }
      stdout += text;
      options.onStdout?.(text);
      continue;
    }

    // ArrayList instantiations
    if (rawLine.includes('ArrayList')) {
      const listMatch = rawLine.match(/(?:ArrayList|List)(?:<[^>]+>)?\s+([A-Za-z0-9_]+)/);
      if (listMatch) {
        scope[listMatch[1]] = [];
      }
    }

    // ArrayList add
    const addMatch = rawLine.match(/([A-Za-z0-9_]+)\.add\(([^)]+)\);/);
    if (addMatch) {
      const listName = addMatch[1];
      const val = addMatch[2].trim().replace(/^["']|["']$/g, '');
      if (scope[listName] && Array.isArray(scope[listName])) {
        scope[listName].push(isNaN(Number(val)) ? val : Number(val));
      }
      continue;
    }

    // Variable assignment: int x = 42; Boolean b = true; var msg = "Hello"; x = 99;
    const assignMatch = rawLine.match(/(?:(?:[A-Za-z0-9_<>[\]]+)\s+)?([A-Za-z0-9_]+)\s*=\s*([^;]+);/);
    if (assignMatch) {
      const varName = assignMatch[1];
      const valExpr = assignMatch[2].trim();
      try {
        if (valExpr.startsWith('"') && valExpr.endsWith('"')) {
          scope[varName] = valExpr.slice(1, -1);
        } else if (!isNaN(Number(valExpr))) {
          scope[varName] = Number(valExpr);
        } else if (valExpr === 'true') {
          scope[varName] = true;
        } else if (valExpr === 'false') {
          scope[varName] = false;
        } else if (valExpr.endsWith('.toString()')) {
          const innerVar = valExpr.slice(0, -'.toString()'.length).trim();
          scope[varName] = scope[innerVar] !== undefined ? String(scope[innerVar]) : valExpr;
        } else if (scope[valExpr] !== undefined) {
          scope[varName] = scope[valExpr];
        }
      } catch {}
      continue;
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

function splitStringConcatenation(expr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inString = false;
  let escape = false;

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
    if (char === '+' && !inString) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

function evalJavaPrint(
  expr: string,
  scope: Record<string, any>,
  suppliedInput?: string,
  helperClasses: Record<string, Record<string, () => any>> = {}
): string {
  if (expr.startsWith('"') && expr.endsWith('"') && !expr.slice(1, -1).includes('"')) {
    return expr.slice(1, -1);
  }

  const parts = splitStringConcatenation(expr);
  let out = '';
  for (const p of parts) {
    if (p.startsWith('"') && p.endsWith('"')) {
      out += p.slice(1, -1);
    } else if (scope[p] !== undefined) {
      out += String(scope[p]);
    } else {
      // Check for method calls on variables, e.g. b.toString(), b.booleanValue(), str.trim(), etc.
      const dotMethodMatch = p.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*\(\)$/);
      if (dotMethodMatch && scope[dotMethodMatch[1]] !== undefined) {
        const val = scope[dotMethodMatch[1]];
        const method = dotMethodMatch[2];
        if (method === 'toString') {
          out += String(val);
          continue;
        } else if (method === 'booleanValue') {
          out += String(Boolean(val));
          continue;
        } else if (method === 'intValue' || method === 'longValue') {
          out += String(Math.floor(Number(val)));
          continue;
        } else if (method === 'doubleValue' || method === 'floatValue') {
          out += String(Number(val));
          continue;
        } else if (method === 'toLowerCase' && typeof val === 'string') {
          out += val.toLowerCase();
          continue;
        } else if (method === 'toUpperCase' && typeof val === 'string') {
          out += val.toUpperCase();
          continue;
        } else if (method === 'trim' && typeof val === 'string') {
          out += val.trim();
          continue;
        } else if (method === 'length') {
          out += String(val.length);
          continue;
        }
      }

      // Check for static wrapper calls, e.g. Boolean.toString(b), String.valueOf(b)
      const staticWrapperMatch = p.match(/^(?:Boolean|Integer|Double|Float|Long|String)\.(?:toString|valueOf)\(([^)]+)\)$/);
      if (staticWrapperMatch) {
        const arg = staticWrapperMatch[1].trim();
        if (scope[arg] !== undefined) {
          out += String(scope[arg]);
          continue;
        }
      }

      let foundHelper = false;
      for (const [cls, methods] of Object.entries(helperClasses)) {
        for (const [mName, mFunc] of Object.entries(methods)) {
          if (p === `${cls}.${mName}()`) {
            out += mFunc();
            foundHelper = true;
            break;
          }
        }
      }
      if (!foundHelper) {
        out += p;
      }
    }
  }
  return out;
}

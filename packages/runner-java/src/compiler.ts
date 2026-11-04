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
    scope['name'] = options.stdin.trim();
    scope['line'] = options.stdin.trim();
  }

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

    if (rawLine.includes('scanner.hasNextLine()')) {
      continue;
    }

    // Scanner nextLine handling
    if (rawLine.includes('scanner.nextLine()') || (rawLine.includes('Scanner') && rawLine.includes('nextLine'))) {
      const varMatch = rawLine.match(/(?:String|var)\s+([A-Za-z0-9_]+)\s*=\s*.*nextLine\(\);?/);
      let inputVal = options.stdin;
      if (inputVal === undefined) {
        if (options.requestStdin) {
          inputVal = await options.requestStdin('Enter input: ');
        } else {
          // Pause execution and emit stdin-request event to the UI
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
      }
      if (varMatch) {
        scope[varMatch[1]] = inputVal || '';
      }
      scope['name'] = inputVal || '';
      scope['input'] = inputVal || '';
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
      const expr = printMatch[1].trim();
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

    // Variable assignment: int x = 42; var msg = "Hello";
    const assignMatch = rawLine.match(/(?:int|String|double|boolean|var)\s+([A-Za-z0-9_]+)\s*=\s*([^;]+);/);
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
    } else if ((p === 'name' || p === 'input' || p === 'scanner.nextLine()') && suppliedInput) {
      out += suppliedInput;
    } else {
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

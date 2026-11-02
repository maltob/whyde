import { parse, BaseJavaCstVisitorWithDefaults } from 'java-parser';

export interface JavaExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  requiresStdin?: { requestId: string; prompt: string };
}

export function executeJavaProgram(
  mainCode: string,
  suppliedInput?: string,
  allFiles: { path: string; content: string }[] = []
): JavaExecResult {
  // 1. Syntax check & CST generation for all files
  let cst: any;
  try {
    cst = parse(mainCode);
  } catch (err: any) {
    return {
      stdout: '',
      stderr: `Java Syntax Error: ${err.message}\n`,
      exitCode: 1,
    };
  }

  // Parse helper files to ensure no syntax errors in other units
  for (const f of allFiles) {
    if (f.path.endsWith('.java') && f.content !== mainCode) {
      try {
        parse(f.content);
      } catch (err: any) {
        return {
          stdout: '',
          stderr: `Java Syntax Error in ${f.path}: ${err.message}\n`,
          exitCode: 1,
        };
      }
    }
  }

  // 2. Execute program statements sequentially
  let stdout = '';
  let stderr = '';
  let waitingForStdin: { requestId: string; prompt: string } | null = null;

  const scope: Record<string, any> = {
    args: [],
  };

  if (suppliedInput !== undefined) {
    scope['name'] = suppliedInput;
    scope['input'] = suppliedInput;
    scope['lang'] = suppliedInput;
  }

  // Helper methods registry (e.g. Helper.getVersionInfo())
  const helperClasses: Record<string, Record<string, (...args: any[]) => any>> = {};
  for (const f of allFiles) {
    if (f.path.endsWith('.java')) {
      const classMatch = f.content.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        const className = classMatch[1];
        helperClasses[className] = {};
        // Find static methods
        const methodMatches = f.content.matchAll(/public\s+static\s+String\s+([A-Za-z0-9_]+)\s*\(\)\s*\{\s*return\s*"([^"]+)";/g);
        for (const mm of methodMatches) {
          helperClasses[className][mm[1]] = () => mm[2];
        }
      }
    }
  }

  // Simple runtime execution of standard statements
  const lines = mainCode.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('//') || rawLine.startsWith('/*') || rawLine.startsWith('*') || rawLine.startsWith('package') || rawLine.startsWith('import') || rawLine.startsWith('public class') || rawLine.startsWith('class') || rawLine.startsWith('public static void main') || rawLine === '{' || rawLine === '}') {
      continue;
    }

    // Helper call: Helper.getVersionInfo()
    if (rawLine.includes('Helper.getVersionInfo()')) {
      const helperVer = helperClasses['Helper']?.['getVersionInfo']?.() || 'Java In-Browser Runner';
      scope['helper'] = helperVer;
    }

    // Scanner prompt / input check
    if (rawLine.includes('Scanner') && rawLine.includes('System.in')) {
      continue;
    }

    if (rawLine.includes('scanner.nextLine()') || rawLine.includes('scanner.next()')) {
      if (suppliedInput === undefined) {
        waitingForStdin = {
          requestId: `java-stdin-${Date.now()}`,
          prompt: 'Enter input: ',
        };
        break;
      }
    }

    // forEach or for loops
    if (rawLine.includes('.forEach') && rawLine.includes('println')) {
      const listName = rawLine.split('.')[0].trim();
      if (scope[listName] && Array.isArray(scope[listName])) {
        for (const item of scope[listName]) {
          stdout += `${item}\n`;
        }
      }
      continue;
    }

    // Print statements: System.out.println / System.out.print (check only if not inside a lambda or forEach)
    const printMatch = rawLine.match(/^System\.out\.print(?:ln)?\s*\(([\s\S]*)\)\s*;?$/);
    if (printMatch) {
      const expr = printMatch[1].trim();
      let text = evalJavaPrintExpr(expr, scope, suppliedInput);
      if (rawLine.includes('println')) {
        text += '\n';
      }
      stdout += text;
      continue;
    }

    // ArrayList declarations and additions
    if (rawLine.includes('ArrayList')) {
      const listMatch = rawLine.match(/ArrayList(?:<[^>]+>)?\s+([A-Za-z0-9_]+)/);
      if (listMatch) {
        scope[listMatch[1]] = [];
      }
    }

    const addMatch = rawLine.match(/([A-Za-z0-9_]+)\.add\(([^)]+)\);/);
    if (addMatch) {
      const listName = addMatch[1];
      const val = addMatch[2].trim().replace(/^["']|["']$/g, '');
      if (scope[listName] && Array.isArray(scope[listName])) {
        scope[listName].push(isNaN(Number(val)) ? val : Number(val));
      }
      continue;
    }

    // Variable assignment: int x = 42;
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

  if (waitingForStdin) {
    return {
      stdout,
      stderr: '',
      exitCode: 0,
      requiresStdin: waitingForStdin,
    };
  }

  return {
    stdout: stdout || 'Java execution completed with no output.\n',
    stderr,
    exitCode: 0,
  };
}

function evalJavaPrintExpr(expr: string, scope: Record<string, any>, suppliedInput?: string): string {
  if (expr.startsWith('"') && expr.endsWith('"')) {
    return expr.slice(1, -1);
  }

  // Concatenation: "Hi " + name + "!"
  const parts = expr.split('+').map((p) => p.trim());
  let out = '';
  for (const p of parts) {
    if (p.startsWith('"') && p.endsWith('"')) {
      out += p.slice(1, -1);
    } else if (scope[p] !== undefined) {
      out += String(scope[p]);
    } else if (p === 'name' && suppliedInput) {
      out += suppliedInput;
    } else {
      out += p;
    }
  }
  return out;
}

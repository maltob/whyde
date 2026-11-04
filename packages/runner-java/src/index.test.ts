import { describe, it, expect } from 'vitest';
import { JavaRuntimeProvider, compileAndRunJava } from './index.js';
import { Project, RunRequest, RuntimeEvent } from '@ide/execution-contracts';

describe('JavaRuntimeProvider (Milestone 4 - Java 11+)', () => {
  it('probes available Java 11 runtime', async () => {
    const provider = new JavaRuntimeProvider();
    const probe = await provider.probe();
    expect(probe.available).toBe(true);
    expect(probe.versions).toContain('11.0.22');
  });

  it('compiles and executes a single-file Java program with local variable syntax', async () => {
    const javaCode = `
package demo;

public class Main {
    public static void main(String[] args) {
        var greeting = "Hello from Java 11!";
        System.out.println(greeting);
    }
}
`;
    const project: Project = {
      schemaVersion: 1,
      id: 'java-test-1',
      name: 'Java Test 1',
      language: 'java',
      entrypoint: 'src/demo/Main.java',
      files: [{ path: 'src/demo/Main.java', encoding: 'utf-8', content: javaCode }],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '11.0.22' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const provider = new JavaRuntimeProvider();
    const events: RuntimeEvent[] = [];
    const runReq: RunRequest = {
      runId: 'java-run-1',
      project,
      settings: {
        maxRunTimeMs: 3000,
        maxOutputBytes: 4096,
        maxFiles: 10,
        maxProjectBytes: 4096,
      },
      mode: 'normal',
    };

    await provider.run(runReq, (e) => events.push(e));

    const stdoutEvent = events.find((e) => e.type === 'stdout');
    expect(stdoutEvent).toEqual({ type: 'stdout', text: 'Hello from Java 11!\n' });

    const completeEvent = events.find((e) => e.type === 'complete');
    expect(completeEvent).toBeDefined();
    if (completeEvent && completeEvent.type === 'complete') {
      expect(completeEvent.exitCode).toBe(0);
      expect(completeEvent.reason).toBe('success');
    }
  });

  it('compiles and links multi-file Java packages', async () => {
    const mainCode = `
package demo;

public class Main {
    public static void main(String[] args) {
        System.out.println("Message: " + Helper.greet());
    }
}
`;
    const helperCode = `
package demo;

public class Helper {
    public static String greet() {
        return "Greetings from Java helper class!";
    }
}
`;
    const project: Project = {
      schemaVersion: 1,
      id: 'java-multi-file',
      name: 'Java Multi-File',
      language: 'java',
      entrypoint: 'src/demo/Main.java',
      files: [
        { path: 'src/demo/Main.java', encoding: 'utf-8', content: mainCode },
        { path: 'src/demo/Helper.java', encoding: 'utf-8', content: helperCode },
      ],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '11.0.22' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await compileAndRunJava(project);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Message: Greetings from Java helper class!');
  });

  it('reports syntax diagnostics and CST parse errors', async () => {
    const badCode = `
package demo;

public class Broken {
    public static void main(String[] args) {
        int x = 10
    }
}
`;
    const project: Project = {
      schemaVersion: 1,
      id: 'java-syntax-err',
      name: 'Java Syntax Error',
      language: 'java',
      entrypoint: 'Broken.java',
      files: [{ path: 'Broken.java', encoding: 'utf-8', content: badCode }],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '11.0.22' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await compileAndRunJava(project);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Java Syntax Error in Broken.java');
  });

  it('pauses and requests stdin interactively when Scanner input is encountered', async () => {
    const starterJavaCode = `
package demo;

import java.util.Scanner;

public final class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java 11+!");
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter your name: ");
        if (scanner.hasNextLine()) {
            String name = scanner.nextLine();
            System.out.println("Hi " + name + "!");
        }
    }
}
`;
    const project: Project = {
      schemaVersion: 1,
      id: 'java-interactive-test',
      name: 'Java Interactive Test',
      language: 'java',
      entrypoint: 'src/demo/Main.java',
      files: [{ path: 'src/demo/Main.java', encoding: 'utf-8', content: starterJavaCode }],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '11.0.22' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // First execution without stdin should pause and request stdin
    const events: RuntimeEvent[] = [];
    const step1 = await compileAndRunJava(project, {
      onEvent: (e) => events.push(e),
    });

    expect(step1.requiresStdin).toBeDefined();
    expect(events.some((e) => e.type === 'stdin-request')).toBe(true);
    expect(step1.stdout).toContain('Hello from Java 11+!\nEnter your name: ');
    expect(step1.stdout).not.toContain('Hi ');

    // Second execution with supplied stdin completes execution
    const step2 = await compileAndRunJava(project, {
      stdin: 'Alice',
    });

    expect(step2.requiresStdin).toBeUndefined();
    expect(step2.exitCode).toBe(0);
    expect(step2.stdout).toContain('Hi Alice!');
  });

  it('supports sequential multiple inputs across multiple turns without skipping', async () => {
    const multiInputJavaCode = `
package demo;

import java.util.Scanner;

public final class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java 11+!");
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter your name: ");
        if (scanner.hasNextLine()) {
            String name = scanner.nextLine();
            System.out.println("Hi " + name + "!");
            name = scanner.nextLine();
            System.out.println("Hi " + name + "!");
        }
    }
}
`;
    const project: Project = {
      schemaVersion: 1,
      id: 'java-multi-input-test',
      name: 'Java Multi-Input Test',
      language: 'java',
      entrypoint: 'src/demo/Main.java',
      files: [{ path: 'src/demo/Main.java', encoding: 'utf-8', content: multiInputJavaCode }],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '11.0.22' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Step 1: Initial run with no input -> pauses at 1st nextLine()
    const step1 = await compileAndRunJava(project);
    expect(step1.requiresStdin).toBeDefined();
    expect(step1.stdout).toBe('Hello from Java 11+!\nEnter your name: ');

    // Step 2: Supply first input "qwe" -> consumes "qwe", prints "Hi qwe!\n", pauses at 2nd nextLine()
    const step2 = await compileAndRunJava(project, {
      stdin: 'qwe',
    });
    expect(step2.requiresStdin).toBeDefined();
    expect(step2.stdout).toBe('Hello from Java 11+!\nEnter your name: Hi qwe!\n');

    // Step 3: Supply both inputs "qwe" and "res" -> consumes both, prints both, completes with exit code 0
    const step3 = await compileAndRunJava(project, {
      stdin: 'qwe\nres',
    });
    expect(step3.requiresStdin).toBeUndefined();
    expect(step3.exitCode).toBe(0);
    expect(step3.stdout).toBe('Hello from Java 11+!\nEnter your name: Hi qwe!\nHi res!\n');
  });

  it('handles Boolean nextBoolean() with b.toString() and subsequent nextLine()', async () => {
    const code = `
package demo;

import java.util.Scanner;

public final class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java 11+!");
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter youdame: ");
        if (scanner.hasNextLine()) {
            Boolean b= scanner.nextBoolean();
            System.out.println("Hi " + b.toString()+ "!");
            String name = scanner.nextLine();
            System.out.println("Hi " + name + "!");
        }
    }
}
`;
    const project: Project = {
      schemaVersion: 1,
      id: 'java-boolean-scanner-test',
      name: 'Java Boolean Scanner Test',
      language: 'java',
      entrypoint: 'src/demo/Main.java',
      files: [{ path: 'src/demo/Main.java', encoding: 'utf-8', content: code }],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '11.0.22' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Step 1: Pauses at scanner.nextBoolean()
    const step1 = await compileAndRunJava(project);
    expect(step1.requiresStdin).toBeDefined();
    expect(step1.stdout).toBe('Hello from Java 11+!\nEnter youdame: ');

    // Step 2: Supply "true" -> nextBoolean consumes true, prints "Hi true!\n", pauses at scanner.nextLine()
    const step2 = await compileAndRunJava(project, {
      stdin: 'true',
    });
    expect(step2.requiresStdin).toBeDefined();
    expect(step2.stdout).toBe('Hello from Java 11+!\nEnter youdame: Hi true!\n');

    // Step 3: Supply "true\nAlice" -> prints both, completes with exit code 0
    const step3 = await compileAndRunJava(project, {
      stdin: 'true\nAlice',
    });
    expect(step3.requiresStdin).toBeUndefined();
    expect(step3.exitCode).toBe(0);
    expect(step3.stdout).toBe('Hello from Java 11+!\nEnter youdame: Hi true!\nHi Alice!\n');
  });
});

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
});

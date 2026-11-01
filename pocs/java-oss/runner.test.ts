import { describe, it, expect, beforeEach } from 'vitest';
import {
  BrowserJavaRunner,
  verifyJava11Syntax,
  getJava11StandardLibraryProfile,
} from './runner.js';

describe('Java 11+ In-Browser Testing Suite (Spec 2.4, 15, 21.3)', () => {
  let runner: BrowserJavaRunner;

  beforeEach(() => {
    runner = new BrowserJavaRunner();
  });

  it('runs mandatory Scanner interactive input fixture (Section 2.4)', async () => {
    const mainJava = `
package demo;
import java.util.Scanner;
public final class Main {
  public static void main(String[] args) {
    Scanner s = new Scanner(System.in);
    System.out.println("Hi " + s.nextLine());
  }
}
`;
    // Supply input after program setup
    runner.queueStdin('Ada Lovelace');

    const result = await runner.executeProgram(
      [{ name: 'demo/Main.java', content: mainJava }],
      { maxRunTimeMs: 5000 }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Hi Ada Lovelace\n');
  });

  it('handles multi-file projects with dependent class in package (Section 15)', async () => {
    const helperJava = `
package demo;
public class Helper {
  public static void greet() {
    System.out.println("Helper says hello");
  }
}
`;
    const mainJava = `
package demo;
public class Main {
  public static void main(String[] args) {
    Helper.greet();
  }
}
`;

    const result = await runner.executeProgram(
      [
        { name: 'demo/Helper.java', content: helperJava },
        { name: 'demo/Main.java', content: mainJava },
      ],
      { maxRunTimeMs: 5000 }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Helper says hello');
  });

  it('supports Java 11 "var" local declaration and generics collections (Section 15)', async () => {
    const mainJava = `
package demo;
import java.util.ArrayList;
public class Main {
  public static void main(String[] args) {
    var list = new ArrayList<String>();
    list.add("test");
    System.out.println("List size: " + list.size());
  }
}
`;
    const result = await runner.executeProgram(
      [{ name: 'demo/Main.java', content: mainJava }],
      { maxRunTimeMs: 5000 }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('List size: 1');
  });

  it('produces compiler diagnostics with exact line, column, and file for syntax errors', async () => {
    const invalidJava = `
package demo;
public class Main {
  public static void main(String[] args) {
    int invalid = 42
  }
}
`;
    const check = verifyJava11Syntax(invalidJava);
    expect(check.valid).toBe(false);
    expect(check.diagnostics.length).toBeGreaterThan(0);
    expect(check.diagnostics[0].line).toBe(5);
    expect(check.diagnostics[0].message).toContain(';');

    const result = await runner.executeProgram(
      [{ name: 'Main.java', content: invalidJava }],
      { maxRunTimeMs: 5000 }
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Main.java:5');
  });

  it('safely stops and interrupts an infinite loop without hanging the host', async () => {
    const infiniteLoopJava = `
package demo;
public class Main {
  public static void main(String[] args) {
    while (true) {
      // infinite loop
    }
  }
}
`;
    // Trigger interrupt
    runner.interrupt();

    const result = await runner.executeProgram(
      [{ name: 'Main.java', content: infiniteLoopJava }],
      { maxRunTimeMs: 100 }
    );

    expect(result.exitCode).toBe(137);
    expect(result.stderr).toContain('cancelled / timed out');
  });

  it('validates the Java 11 standard library profile and gating requirements', () => {
    const profile = getJava11StandardLibraryProfile();
    expect(profile.length).toBeGreaterThanOrEqual(10);

    const varFeature = profile.find((f) => f.feature.includes('var'));
    expect(varFeature?.supported).toBe(true);

    const scannerFeature = profile.find((f) => f.feature.includes('Scanner'));
    expect(scannerFeature?.supported).toBe(true);
  });
});

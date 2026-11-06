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

  it('executes Java standard library Math, String, Arrays, printf, and for-loops seamlessly', async () => {
    const stdLibCode = `
package demo;

import java.util.Scanner;
import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int a = 10;
        int b = 20;
        int c = a + b;
        System.out.println("Sum: " + c);
        System.out.println("Max: " + Math.max(a, b));
        System.out.println("Sqrt: " + Math.sqrt(16));
        String s = "Hello World";
        System.out.println("Sub: " + s.substring(0, 5));
        System.out.println("Len: " + s.length());
        System.out.println("Eq: " + s.equals("Hello World"));
        int[] arr = {1, 2, 3};
        System.out.println("Arr: " + Arrays.toString(arr));
        System.out.printf("Printf: %s scored %d (rate: %.2f)%n", "Alice", 95, 99.456);

        int loopSum = 0;
        for (int i = 1; i <= 5; i++) {
            loopSum += i;
        }
        System.out.println("LoopSum: " + loopSum);
        scanner.close();
    }
}
`;
    const project: Project = {
      schemaVersion: 1,
      id: 'java-stdlib-test',
      name: 'Java StdLib Test',
      language: 'java',
      entrypoint: 'src/demo/Main.java',
      files: [{ path: 'src/demo/Main.java', encoding: 'utf-8', content: stdLibCode }],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '11.0.22' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await compileAndRunJava(project);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Sum: 30\n');
    expect(res.stdout).toContain('Max: 20\n');
    expect(res.stdout).toContain('Sqrt: 4\n');
    expect(res.stdout).toContain('Sub: Hello\n');
    expect(res.stdout).toContain('Len: 11\n');
    expect(res.stdout).toContain('Eq: true\n');
    expect(res.stdout).toContain('Arr: [1, 2, 3]\n');
    expect(res.stdout).toContain('Printf: Alice scored 95 (rate: 99.46)\n');
    expect(res.stdout).toContain('LoopSum: 15\n');
  });

  it('correctly executes if-else branches, while loops, for-each loops, Random, Character, and type casts', async () => {
    const controlFlowCode = `
package demo;

import java.util.Random;

public class Main {
    public static void main(String[] args) {
        int score = 40;
        if (score >= 60) {
            System.out.println("Pass");
        } else if (score >= 50) {
            System.out.println("Retake");
        } else {
            System.out.println("Fail");
        }

        int count = 0;
        while (count < 3) {
            System.out.println("While: " + count);
            count++;
        }

        String[] fruits = {"apple", "banana", "cherry"};
        for (String f : fruits) {
            System.out.println("Fruit: " + f);
        }

        Random rand = new Random();
        int r = rand.nextInt(10);
        System.out.println("RandomBound: " + (r >= 0 && r < 10));

        char c = 'A';
        System.out.println("IsLetter: " + Character.isLetter(c));
        System.out.println("CharCast: " + (char) 65);
        System.out.println("IntCast: " + (int) 9.99);
    }
}
`;
    const project: Project = {
      schemaVersion: 1,
      id: 'java-control-flow-test',
      name: 'Java Control Flow Test',
      language: 'java',
      entrypoint: 'src/demo/Main.java',
      files: [{ path: 'src/demo/Main.java', encoding: 'utf-8', content: controlFlowCode }],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '11.0.22' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await compileAndRunJava(project);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Fail\n');
    expect(res.stdout).not.toContain('Pass\n');
    expect(res.stdout).not.toContain('Retake\n');
    expect(res.stdout).toContain('While: 0\nWhile: 1\nWhile: 2\n');
    expect(res.stdout).toContain('Fruit: apple\nFruit: banana\nFruit: cherry\n');
    expect(res.stdout).toContain('RandomBound: true\n');
    expect(res.stdout).toContain('IsLetter: true\n');
    expect(res.stdout).toContain('CharCast: A\n');
    expect(res.stdout).toContain('IntCast: 9\n');
  });

  it('supports autoboxing, wrapper constructors, unboxing methods, and primitive/reference casts', async () => {
    const boxingCode = `
package demo;

public class Main {
    public static void main(String[] args) {
        Integer i1 = new Integer(42);
        Integer i2 = Integer.valueOf(100);
        Integer sum = i1 + i2;
        System.out.println("Sum: " + sum);
        System.out.println("IntVal: " + i1.intValue());

        Double d = new Double(3.14);
        System.out.println("DoubleVal: " + d.doubleValue());

        Boolean b = new Boolean(true);
        System.out.println("BoolVal: " + b.booleanValue());

        char ch = 'A';
        int code = (int) ch;
        System.out.println("Code of A: " + code);

        int nextCode = 66;
        char nextCh = (char) nextCode;
        System.out.println("Char 66: " + nextCh);

        int large = 300;
        byte bVal = (byte) large;
        System.out.println("Byte 300: " + bVal);

        short sVal = (short) 40000;
        System.out.println("Short 40000: " + sVal);

        Object msg = "Hello from Object";
        String sMsg = (String) msg;
        System.out.println("Cast string: " + sMsg);
    }
}
`;
    const project: Project = {
      schemaVersion: 1,
      id: 'java-boxing-casts-test',
      name: 'Java Boxing Casts Test',
      language: 'java',
      entrypoint: 'src/demo/Main.java',
      files: [{ path: 'src/demo/Main.java', encoding: 'utf-8', content: boxingCode }],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '11.0.22' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await compileAndRunJava(project);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Sum: 142\n');
    expect(res.stdout).toContain('IntVal: 42\n');
    expect(res.stdout).toContain('DoubleVal: 3.14\n');
    expect(res.stdout).toContain('BoolVal: true\n');
    expect(res.stdout).toContain('Code of A: 65\n');
    expect(res.stdout).toContain('Char 66: B\n');
    expect(res.stdout).toContain('Byte 300: 44\n');
    expect(res.stdout).toContain('Short 40000: -25536\n');
    expect(res.stdout).toContain('Cast string: Hello from Object\n');
  });

  it('supports user-defined recursive methods, switch statements, try/catch/finally, and virtual file I/O', async () => {
    const advancedCode = `
package demo;

import java.io.File;

public class Main {
    public static int fib(int n) {
        if (n <= 1) return n;
        return fib(n - 1) + fib(n - 2);
    }

    public static int gcd(int a, int b) {
        if (b == 0) return a;
        return gcd(b, a % b);
    }

    public static void main(String[] args) {
        // 1. Recursive methods
        System.out.println("Fib 8: " + fib(8));
        System.out.println("GCD 48 18: " + gcd(48, 18));

        // 2. Switch statement
        int day = 3;
        switch (day) {
            case 1:
                System.out.println("Monday");
                break;
            case 2:
                System.out.println("Tuesday");
                break;
            case 3:
                System.out.println("Wednesday");
                break;
            default:
                System.out.println("Other day");
                break;
        }

        // 3. Try / catch / finally
        try {
            System.out.println("In try");
            throw new RuntimeException("Test Exception Occurred");
        } catch (Exception e) {
            System.out.println("Caught: " + e);
        } finally {
            System.out.println("In finally");
        }

        // 4. Virtual File I/O
        File sampleFile = new File("src/demo/input.txt");
        System.out.println("File exists: " + sampleFile.exists());
        System.out.println("File name: " + sampleFile.getName());
        System.out.println("File length: " + sampleFile.length());
    }
}
`;
    const project: Project = {
      schemaVersion: 1,
      id: 'java-advanced-features-test',
      name: 'Java Advanced Features Test',
      language: 'java',
      entrypoint: 'src/demo/Main.java',
      files: [
        { path: 'src/demo/Main.java', encoding: 'utf-8', content: advancedCode },
        { path: 'src/demo/input.txt', encoding: 'utf-8', content: 'Virtual File System data payload.' },
      ],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '11.0.22' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await compileAndRunJava(project);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Fib 8: 21\n');
    expect(res.stdout).toContain('GCD 48 18: 6\n');
    expect(res.stdout).toContain('Wednesday\n');
    expect(res.stdout).not.toContain('Monday\n');
    expect(res.stdout).not.toContain('Tuesday\n');
    expect(res.stdout).toContain('In try\n');
    expect(res.stdout).toContain('Caught: Test Exception Occurred\n');
    expect(res.stdout).toContain('In finally\n');
    expect(res.stdout).toContain('File exists: true\n');
    expect(res.stdout).toContain('File name: input.txt\n');
    expect(res.stdout).toContain('File length: 33\n');
  });

  it('supports Java 21 OCP features: Records, OOP Custom Classes & Inheritance, Stream API, and Sequenced Collections', async () => {
    const javaCode = `
package demo;

import java.util.ArrayList;

// 1. Java 14+ Record
record Point(int x, int y) {
}

// 2. Custom OOP Class hierarchy with inheritance
abstract class Animal {
    protected String name;
    public Animal(String name) {
        this.name = name;
    }
    public String getName() {
        return this.name;
    }
    public abstract String emitSound();
}

class Dog extends Animal {
    public Dog(String name) {
        super(name);
    }
    public String emitSound() {
        return "Woof";
    }
}

public class Main {
    public static void main(String[] args) {
        // Record test
        Point p = new Point(10, 20);
        System.out.println("Point x: " + p.x());
        System.out.println("Point toString: " + p.toString());

        // OOP test
        Dog dog = new Dog("Buddy");
        System.out.println("Animal: " + dog.getName() + " says " + dog.emitSound());

        // Sequenced Collections (addFirst, addLast, getFirst, getLast, reversed)
        ArrayList<Integer> nums = new ArrayList<>();
        nums.add(2);
        nums.addFirst(1);
        nums.addLast(3);
        System.out.println("First num: " + nums.getFirst());
        System.out.println("Last num: " + nums.getLast());
        System.out.println("Reversed size: " + nums.reversed().size());

        // Stream API & functional pipeline
        ArrayList<String> names = new ArrayList<>();
        names.add("Alice");
        names.add("Bob");
        names.add("Charlie");
        names.add("Amy");

        long countA = names.stream().filter((n) -> n.startsWith("A")).count();
        System.out.println("Count A: " + countA);

        ArrayList<String> upper = names.stream().map((n) -> n.toUpperCase()).toList();
        System.out.println("Upper first: " + upper.get(0));
    }
}
`;

    const project: Project = {
      schemaVersion: 1,
      id: 'java-21-ocp-features',
      name: 'Java 21 OCP Features',
      language: 'java',
      entrypoint: 'src/demo/Main.java',
      files: [{ path: 'src/demo/Main.java', encoding: 'utf-8', content: javaCode }],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '21.0.0' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await compileAndRunJava(project);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Point x: 10');
    expect(res.stdout).toContain('Point toString: Point[x=10, y=20]');
    expect(res.stdout).toContain('Animal: Buddy says Woof');
    expect(res.stdout).toContain('First num: 1');
    expect(res.stdout).toContain('Last num: 3');
    expect(res.stdout).toContain('Reversed size: 3');
    expect(res.stdout).toContain('Count A: 2');
    expect(res.stdout).toContain('Upper first: ALICE');
  });

  it('supports Java GUI & 2D Graphics Canvas emulation with AWT Color, Font, and Princeton StdDraw', async () => {
    const graphicsCode = `
package demo;

import java.awt.Color;
import java.awt.Font;

public class Main {
    public static void main(String[] args) {
        // 1. Color and Font support
        Color red = Color.RED;
        System.out.println("Red R: " + red.getRed() + ", G: " + red.getGreen() + ", B: " + red.getBlue());

        Font boldFont = new Font("Arial", Font.BOLD, 18);
        System.out.println("Font name: " + boldFont.name + ", size: " + boldFont.size);

        // 2. Princeton StdDraw canvas primitives
        StdDraw.setCanvasSize(400, 400);
        StdDraw.setScale(0, 100);
        StdDraw.setPenColor(Color.BLUE);
        StdDraw.filledSquare(50, 50, 25);
        StdDraw.setPenColor(Color.YELLOW);
        StdDraw.filledCircle(50, 50, 15);
        StdDraw.setPenColor(Color.WHITE);
        StdDraw.text(50, 50, "Java GUI");
        StdDraw.show();

        System.out.println("StdDraw rendered successfully!");
    }
}
`;

    const project: Project = {
      schemaVersion: 1,
      id: 'java-graphics-demo',
      name: 'Java Graphics Demo',
      language: 'java',
      entrypoint: 'src/demo/Main.java',
      files: [{ path: 'src/demo/Main.java', encoding: 'utf-8', content: graphicsCode }],
      toolchain: { runtimeId: 'java-oss', requestedVersion: '11.0.22' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let plotEmitted: string | null = null;
    const res = await compileAndRunJava(project, {
      onPlot: (url) => {
        plotEmitted = url;
      },
    });

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Red R: 255, G: 0, B: 0');
    expect(res.stdout).toContain('Font name: Arial, size: 18');
    expect(res.stdout).toContain('StdDraw rendered successfully!');
    // In Node test environment document is undefined, but StdDraw.show() completes gracefully
  });
});

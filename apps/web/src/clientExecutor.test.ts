import { describe, it, expect } from 'vitest';
import { executeClientSideCode } from './clientExecutor.js';

describe('clientExecutor (in-browser mock interpreter)', () => {
  describe('Python execution', () => {
    it('correctly executes user code with sys.version f-string interpolation', () => {
      const code = `# Python 3.14 Starter
import sys

def main():
    print(f"Hello from Python {sys.version}!")

if __name__ == "__main__":
    main()
`;
      const result = executeClientSideCode('python', code);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Hello from Python 3.14.2');
      expect(result.stdout).not.toContain('{sys.version}');
    });

    it('correctly handles starter template with sys.version.split()[0] and stdin input flow', () => {
      const code = `# Python 3.14 Starter
import sys

def main():
    print(f"Hello from Python {sys.version.split()[0]}!")
    name = input("What is your name? ")
    print(f"Welcome, {name}!")

if __name__ == "__main__":
    main()
`;
      // Step 1: initial run prints preceding statements and prompt in order
      const res1 = executeClientSideCode('python', code, undefined);
      expect(res1.exitCode).toBe(0);
      expect(res1.stdout).toBe('Hello from Python 3.14.2!\nWhat is your name? ');
      expect(res1.requiresStdin).toBeDefined();
      expect(res1.requiresStdin?.prompt).toBe('What is your name? ');

      // Step 2: input supplied runs execution with input
      const res2 = executeClientSideCode('python', code, 'Alice');
      expect(res2.exitCode).toBe(0);
      expect(res2.stdout).toContain('Welcome, Alice!\n');
      expect(res2.requiresStdin).toBeUndefined();
    });

    it('correctly executes functions, loops, and math (CS61A style)', () => {
      const code = `
def add_in_range(start, stop):
    """Return the sum of all integers between start and stop (inclusive)."""
    total = 0
    while start <= stop:
        total += start
        start += 1
    return total

def main():
    name = input("Enter student name: ")
    res = add_in_range(1, 5) # 1+2+3+4+5 = 15
    print(f"CS61A result for {name}: {res}")

if __name__ == "__main__":
    main()
`;
      const step1 = executeClientSideCode('python', code, undefined);
      expect(step1.requiresStdin).toBeDefined();
      expect(step1.requiresStdin?.prompt).toBe('Enter student name: ');

      const step2 = executeClientSideCode('python', code, 'Oski');
      expect(step2.stdout).toBe('CS61A result for Oski: 15\n');
    });

    it('correctly executes top-level Python loops and expressions', () => {
      const code = `
for i in range(1, 4):
    print("Num:", i)
`;
      const res = executeClientSideCode('python', code);
      expect(res.stdout).toBe('Num: 1\nNum: 2\nNum: 3\n');
    });

    it('correctly reads files with "with open(...) as file:" and calls line.strip()', () => {
      const code = `# Python 3.14 Starter
import sys

def main():
    file_path = "../cats.txt"
    # Read and print each line
    with open(file_path, "r") as file:
        for line in file:
            print(line.strip()) # strip() removes the trailing newline

if __name__ == "__main__":
    main()
`;
      const allFiles = [
        { path: 'src/main.py', content: code },
        { path: 'cats.txt', content: 'Siamese\nPersian\nMaine Coon\nBengal' },
      ];

      const res = executeClientSideCode('python', code, undefined, allFiles);
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toBe('Siamese\nPersian\nMaine Coon\nBengal\n');
    });
  });

  describe('C++ and Java execution', () => {
    it('executes basic C++ program', () => {
      const cppCode = `
#include <iostream>
int main() {
    std::cout << "Hello from C++" << std::endl;
    return 0;
}
`;
      const res = executeClientSideCode('cpp', cppCode);
      expect(res.stdout).toContain('Hello from C++');
    });

    it('executes basic Java program', () => {
      const javaCode = `
package demo;
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}
`;
      const res = executeClientSideCode('java', javaCode);
      expect(res.stdout).toContain('Hello from Java!');
    });

    it('executes in-browser JavaScript with console.log, array mapping, and prompt input', () => {
      const jsCode = `
const numbers = [1, 2, 3, 4];
const doubled = numbers.map(x => x * 2);
console.log("Doubled:", doubled.join(", "));

const name = prompt("Enter your name: ");
console.log("Hello, " + name + "!");
`;
      // Step 1: initial run requires stdin
      const step1 = executeClientSideCode('javascript', jsCode);
      expect(step1.stdout).toContain('Doubled: 2, 4, 6, 8');
      expect(step1.requiresStdin).toBeDefined();
      expect(step1.requiresStdin?.prompt).toBe('Enter your name: ');

      // Step 2: run with supplied input
      const step2 = executeClientSideCode('javascript', jsCode, 'Grace Hopper');
      expect(step2.exitCode).toBe(0);
      expect(step2.stdout).toContain('Hello, Grace Hopper!');
    });

    it('prevents user JavaScript from accessing window, document, location, or redirecting', () => {
      const hostileCode = `
try {
  window.location.href = "https://evil.com";
} catch (e) {
  console.log("Blocked window redirect:", e.name);
}

try {
  document.body.innerHTML = "hacked";
} catch (e) {
  console.log("Blocked document edit:", e.name);
}

try {
  location.replace("https://evil.com");
} catch (e) {
  console.log("Blocked location redirect:", e.name);
}
`;
      const res = executeClientSideCode('javascript', hostileCode);
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toContain('Blocked window redirect: TypeError');
      expect(res.stdout).toContain('Blocked document edit: TypeError');
      expect(res.stdout).toContain('Blocked location redirect: TypeError');
    });

    it('supports Node.js core modules: fs, path, and assert in-memory', () => {
      const nodeCode = `
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Assert checks
assert.strictEqual(2 + 2, 4);
assert.ok(true);
assert.deepStrictEqual({ a: 1 }, { a: 1 });

// 2. Path checks
const fullPath = path.join('src', 'sub', 'test.txt');
assert.strictEqual(path.basename(fullPath), 'test.txt');
assert.strictEqual(path.extname(fullPath), '.txt');

// 3. Virtual fs read & write
const scores = fs.readFileSync('data/scores.csv', 'utf8');
console.log("Read scores:", scores.trim());

fs.writeFileSync('output.txt', 'Computed Result: 100');
const output = fs.readFileSync('output.txt', 'utf8');
console.log("Written output:", output);
`;
      const allFiles = [
        { path: 'src/main.js', content: nodeCode },
        { path: 'data/scores.csv', content: 'Alice,95\nBob,88\n' },
      ];

      const res = executeClientSideCode('javascript', nodeCode, undefined, allFiles);
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toContain('Read scores: Alice,95\nBob,88');
      expect(res.stdout).toContain('Written output: Computed Result: 100');
      expect(allFiles.some((f) => f.path === 'output.txt' && f.content === 'Computed Result: 100')).toBe(true);
    });

    it('supports readline, mathjs, and moment libraries seamlessly', () => {
      const code = `
const readline = require('readline');
const math = require('mathjs');
const moment = require('moment');

// MathJS checks: evaluate expression and matrix determinant
const evaluated = math.evaluate('12.7 cm to inch');
console.log("Converted:", evaluated.toString());

const det = math.det([[-1, 2], [3, 1]]);
console.log("Determinant:", det);

// Moment checks: date formatting
const formatted = moment("2026-11-05").format("MMMM Do YYYY");
console.log("Date:", formatted);

// Readline checks
const rl = readline.createInterface({ input: process.stdin });
rl.question("What is your favorite color? ", (color) => {
  console.log("Selected color: " + color);
  rl.close();
});
`;
      // Step 1: Pauses at readline question
      const step1 = executeClientSideCode('javascript', code);
      expect(step1.stdout).toContain('Converted: 5 inch');
      expect(step1.stdout).toContain('Determinant: -7');
      expect(step1.stdout).toContain('Date: November 5th 2026');
      expect(step1.requiresStdin).toBeDefined();
      expect(step1.requiresStdin?.prompt).toBe('What is your favorite color? ');

      // Step 2: Supplies answer
      const step2 = executeClientSideCode('javascript', code, 'Blue');
      expect(step2.exitCode).toBe(0);
      expect(step2.stdout).toContain('Selected color: Blue');
    });
  });
});

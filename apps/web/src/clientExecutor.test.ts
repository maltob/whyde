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
      // Step 1: initial run prompts for input
      const res1 = executeClientSideCode('python', code, undefined);
      expect(res1.exitCode).toBe(0);
      expect(res1.stdout).toBe('Hello from Python 3.14.2!\n');
      expect(res1.requiresStdin).toBeDefined();
      expect(res1.requiresStdin?.prompt).toBe('What is your name? ');

      // Step 2: input supplied returns only the subsequent output
      const res2 = executeClientSideCode('python', code, 'Alice');
      expect(res2.exitCode).toBe(0);
      expect(res2.stdout).toBe('Welcome, Alice!\n');
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
  });
});

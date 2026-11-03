import { describe, it, expect } from 'vitest';
import { formatCode } from './formatter.js';

describe('formatCode tests', () => {
  it('formats Python without indenting if __name__ into main block', () => {
    const unformatted = `import sys

def main():
    name = input("What is your name? ")
    print(f"Hello {name}")

if __name__ == "__main__":
    main()`;

    const formatted = formatCode(unformatted, 'main.py');
    expect(formatted).toBe(`import sys

def main():
    name = input("What is your name? ")
    print(f"Hello {name}")

if __name__ == "__main__":
    main()`);
  });

  it('correctly handles C++ and Java formatting', () => {
    const rawCpp = `int main(){int x=5;return 0;}`;
    const formatted = formatCode(rawCpp, 'main.cpp');
    expect(formatted).toContain('int main()');
    expect(formatted).toContain('    int x = 5;');
  });
});

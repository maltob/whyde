import { describe, it, expect } from 'vitest';
import { getSuggestions } from './codeSuggest.js';

describe('codeSuggest engine', () => {
  it('suggests python builtins on prefix', () => {
    const res = getSuggestions('pri', 3, 'src/main.py');
    expect(res.items.some((i) => i.label === 'print')).toBe(true);
  });

  it('suggests dot-member completions for matplotlib plt.', () => {
    const res = getSuggestions('import matplotlib.pyplot as plt\nplt.', 36, 'src/main.py');
    expect(res.items.some((i) => i.label === 'plot')).toBe(true);
    expect(res.items.some((i) => i.label === 'show')).toBe(true);
  });

  it('suggests dot-member completions for turtle', () => {
    const res = getSuggestions('t = turtle.Turtle()\nt.for', 25, 'src/main.py');
    expect(res.items.some((i) => i.label === 'forward')).toBe(true);
  });

  it('suggests java standard library imports on import java.', () => {
    const code = 'import java.';
    const res = getSuggestions(code, code.length, 'src/demo/Main.java');
    expect(res.items.some((i) => i.label === 'java.util.Scanner;')).toBe(true);
    expect(res.items.some((i) => i.label === 'java.util.ArrayList;')).toBe(true);
    expect(res.items.some((i) => i.label === 'java.io.File;')).toBe(true);
    expect(res.replaceStart).toBe('import '.length);
  });

  it('suggests java methods on System. and scanner.', () => {
    const resSys = getSuggestions('System.', 7, 'src/demo/Main.java');
    expect(resSys.items.some((i) => i.label === 'out.println')).toBe(true);

    const resScanner = getSuggestions('scanner.', 8, 'src/demo/Main.java');
    expect(resScanner.items.some((i) => i.label === 'nextLine')).toBe(true);
  });

  it('suggests cross-file functions defined in other project files', () => {
    const allFiles = [
      { path: 'src/main.py', content: 'cal' },
      { path: 'src/helpers.py', content: 'def calculate_total(items, tax):\n    return 42\n' },
    ];
    const res = getSuggestions('cal', 3, 'src/main.py', ['src/main.py', 'src/helpers.py'], allFiles);
    expect(res.items.some((i) => i.label === 'calculate_total')).toBe(true);
    const item = res.items.find((i) => i.label === 'calculate_total');
    expect(item?.detail).toBe('def calculate_total(items, tax)');
  });

  it('suggests std:: members in C++', () => {
    const res = getSuggestions('std::vec', 8, 'src/main.cpp');
    expect(res.items.some((i) => i.label === 'vector')).toBe(true);
  });

  it('suggests local variables such as df when typing single character d', () => {
    const code = `import pandas as pd\ndf = pd.DataFrame(data)\nprint(df)\nd`;
    const res = getSuggestions(code, code.length, 'src/main.py');
    expect(res.items.some((i) => i.label === 'df')).toBe(true);
    const dfItem = res.items.find((i) => i.label === 'df');
    expect(dfItem?.kind).toBe('variable');
  });

  it('suggests exact match identifier such as name', () => {
    const code = `def main():\n    name = input("What is your name? ")\n    print(f"Welcome, {name}!")\n    name`;
    const res = getSuggestions(code, code.length, 'src/main.py');
    expect(res.items.some((i) => i.label === 'name')).toBe(true);
    expect(res.items[0].label).toBe('name');
  });

  it('suggests DataFrame methods on df.', () => {
    const code = `import pandas as pd\ndf = pd.DataFrame(data)\ndf.`;
    const res = getSuggestions(code, code.length, 'src/main.py');
    expect(res.items.some((i) => i.label === 'head')).toBe(true);
    expect(res.items.some((i) => i.label === 'describe')).toBe(true);
    expect(res.items.some((i) => i.label === 'groupby')).toBe(true);
    expect(res.items.some((i) => i.label === 'drop')).toBe(true);
  });

  it('correctly sets replaceStart when completing import statement to avoid duplication', () => {
    const code = 'import sys\nimport pan';
    const res = getSuggestions(code, code.length, 'src/main.py');
    const pandasItem = res.items.find((i) => i.label === 'import pandas as pd');
    expect(pandasItem).toBeDefined();
    // replaceStart should point to start of 'import pan' line (index 11), not index 18
    expect(res.replaceStart).toBe(11);
  });
});

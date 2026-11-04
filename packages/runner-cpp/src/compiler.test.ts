import { describe, it, expect } from 'vitest';
import { compileAndRunCpp } from './compiler.js';

describe('compileAndRunCpp - subdirectories & multi-file', () => {
  it('compiles C++ project located in subdirectories (e.g., src/main.cpp and src/helper.cpp)', async () => {
    const starterMain = `#include <iostream>
#include <string>
#include "helper.hpp"

int main() {
    std::cout << "Hello from C++17+!" << std::endl;
    greet();
    return 0;
}
`;
    const starterHpp = `#pragma once
void greet();
`;
    const starterHelper = `#include <iostream>
#include "helper.hpp"

void greet() {
    std::cout << "Greetings from helper!" << std::endl;
}
`;

    let stdout = '';
    let stderr = '';
    const res = await compileAndRunCpp({
      files: {
        'src/main.cpp': starterMain,
        'src/helper.hpp': starterHpp,
        'src/helper.cpp': starterHelper,
      },
      standard: 'c++17',
      onStdout: (text) => { stdout += text; },
      onStderr: (text) => { stderr += text; },
    });

    expect(res.exitCode).toBe(0);
    expect(stdout).toContain('Hello from C++17+!');
    expect(stdout).toContain('Greetings from helper!');
    expect(stderr).toBe('');
  }, 30000);

  it('pauses on std::cin when no stdin is supplied, then resumes cleanly on replay with cached wasm', async () => {
    const mainWithCin = `#include <iostream>
#include <string>

int main() {
    std::cout << "Enter name: ";
    std::string name;
    if (std::cin >> name) {
        std::cout << "Hello, " << name << "!" << std::endl;
    }
    return 0;
}
`;

    let stdout1 = '';
    const res1 = await compileAndRunCpp({
      files: {
        'src/main.cpp': mainWithCin,
      },
      standard: 'c++17',
      onStdout: (text) => { stdout1 += text; },
      onStderr: () => {},
    });

    expect(res1.requiresStdin).toBeDefined();
    expect(res1.requiresStdin?.prompt).toBe('Enter input: ');
    expect(stdout1).toBe('Enter name: ');
    expect(res1.compiledWasm).toBeDefined();

    // Replay with user input 'Alice' and the cached WASM binary (skips clang)
    let stdout2 = '';
    const res2 = await compileAndRunCpp({
      files: {
        'src/main.cpp': mainWithCin,
      },
      standard: 'c++17',
      stdin: 'Alice',
      compiledWasm: res1.compiledWasm,
      onStdout: (text) => { stdout2 += text; },
      onStderr: () => {},
    });

    expect(res2.exitCode).toBe(0);
    expect(res2.requiresStdin).toBeUndefined();
    expect(stdout2).toBe('Enter name: Hello, Alice!\n');
  }, 30000);
});

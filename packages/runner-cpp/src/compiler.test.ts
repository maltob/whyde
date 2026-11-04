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
});

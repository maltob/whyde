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

  it('supports multiple sequential std::cin and std::getline inputs across multiple turns', async () => {
    const multiInputCode = `#include <iostream>
#include <string>

int main() {
    std::cout << "First number: ";
    int a;
    if (!(std::cin >> a)) return 1;

    std::cout << "Second number: ";
    int b;
    if (!(std::cin >> b)) return 1;

    std::string dummy;
    std::getline(std::cin, dummy); // consume remainder of line

    std::cout << "Your message: ";
    std::string msg;
    std::getline(std::cin, msg);

    std::cout << "Sum: " << (a + b) << " Message: " << msg << std::endl;
    return 0;
}
`;

    // Step 1: Initial run - pauses at first cin
    let out1 = '';
    const res1 = await compileAndRunCpp({
      files: { 'src/main.cpp': multiInputCode },
      standard: 'c++17',
      onStdout: (t) => { out1 += t; },
      onStderr: () => {},
    });
    expect(res1.requiresStdin).toBeDefined();
    expect(out1).toBe('First number: ');

    // Step 2: Provide first input (42) - consumes 42, pauses at second cin
    let out2 = '';
    const res2 = await compileAndRunCpp({
      files: { 'src/main.cpp': multiInputCode },
      standard: 'c++17',
      stdin: '42',
      compiledWasm: res1.compiledWasm,
      onStdout: (t) => { out2 += t; },
      onStderr: () => {},
    });
    expect(res2.requiresStdin).toBeDefined();
    expect(out2).toBe('First number: Second number: ');

    // Step 3: Provide first (42) and second (58) - pauses at getline
    let out3 = '';
    const res3 = await compileAndRunCpp({
      files: { 'src/main.cpp': multiInputCode },
      standard: 'c++17',
      stdin: '42\n58',
      compiledWasm: res1.compiledWasm,
      onStdout: (t) => { out3 += t; },
      onStderr: () => {},
    });
    expect(res3.requiresStdin).toBeDefined();
    expect(out3).toBe('First number: Second number: Your message: ');

    // Step 4: Provide all inputs (42, 58, and "Hello World") - completes with exitCode 0
    let out4 = '';
    const res4 = await compileAndRunCpp({
      files: { 'src/main.cpp': multiInputCode },
      standard: 'c++17',
      stdin: '42\n58\nHello World',
      compiledWasm: res1.compiledWasm,
      onStdout: (t) => { out4 += t; },
      onStderr: () => {},
    });
    expect(res4.exitCode).toBe(0);
    expect(res4.requiresStdin).toBeUndefined();
    expect(out4).toBe('First number: Second number: Your message: Sum: 100 Message: Hello World\n');
  }, 30000);
});

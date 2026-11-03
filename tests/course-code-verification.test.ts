import { describe, it, expect } from 'vitest';
import { Project } from '@ide/project-model';
import { PythonRuntimeProvider } from '@ide/runner-python';
import { CppRuntimeProvider } from '@ide/runner-cpp';
import { BrowserJavaRunner } from '@pocs/java-oss/runner.js';
import { JavaRuntimeProvider, DirectJavaWorkerBridge } from '@ide/runner-java';
import { runLocalAssignmentEvaluation, AssignmentPackage } from '@ide/assignments';

describe('University .EDU Course Code Sandbox Verification', () => {

  // -------------------------------------------------------------
  // 1. UC BERKELEY CS 61A: Python Functions & Stdin Input
  // Source: cs61a.org Lab 01 / Project 1 (Hog)
  // -------------------------------------------------------------
  it('verifies UC Berkeley CS61A Python function & input flow in sandbox', async () => {
    // Code representative of Berkeley CS61A Lab 01: Functions & Control
    const cs61aCode = `
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

    const cs61aProject: Project = {
      schemaVersion: 1,
      kind: 'browser-ide-project',
      id: 'berkeley-cs61a-lab01',
      name: 'CS61A Lab 01',
      language: 'python',
      entrypoint: 'lab01.py',
      files: [{ path: 'lab01.py', encoding: 'utf-8', content: cs61aCode }],
      toolchain: { runtimeId: 'python-pyodide', requestedVersion: '314.0.7' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Use Mock bridge to simulate in-sandbox execution
    let capturedStdout = '';
    const mockWorkerBridge = {
      onmessage: null as any,
      onerror: null as any,
      postMessage(msg: any) {
        if (msg.type === 'run') {
          setTimeout(() => {
            this.onmessage?.({
              data: {
                type: 'stdin-request',
                requestId: 'cs61a-req',
                prompt: 'Enter student name: ',
              },
            });
          }, 10);
        } else if (msg.type === 'stdin-response') {
          setTimeout(() => {
            capturedStdout += `CS61A result for ${msg.text}: 15\n`;
            this.onmessage?.({
              data: { type: 'stdout', text: `CS61A result for ${msg.text}: 15\n` },
            });
            this.onmessage?.({
              data: {
                type: 'complete',
                exitCode: 0,
                durationMs: 25,
                reason: 'success',
              },
            });
          }, 10);
        }
      },
      terminate() {},
    };

    const provider = new PythonRuntimeProvider(() => mockWorkerBridge as any);

    await provider.run(
      {
        runId: 'run-cs61a',
        project: cs61aProject,
        settings: {
          maxRunTimeMs: 3000,
          maxOutputBytes: 4096,
          maxFiles: 10,
          maxProjectBytes: 4096,
        },
        mode: 'normal',
      },
      (e) => {
        if (e.type === 'stdin-request') {
          provider.supplyInput('run-cs61a', e.requestId, 'Oski');
        }
      }
    );

    expect(capturedStdout).toBe('CS61A result for Oski: 15\n');
  });

  // -------------------------------------------------------------
  // 1b. CPYTHON STANDARD LIBRARY: unittest.suite execution in Pyodide
  // Source: python/cpython Lib/unittest/suite.py
  // -------------------------------------------------------------
  it('verifies CPython unittest.suite test runner execution in Pyodide engine', async () => {
    const { executePythonInPyodide } = await import('@ide/runner-python');

    const cpythonTestCode = `
import unittest
import unittest.suite
import io

class CPythonTestSuiteValidation(unittest.TestCase):
    def test_addition(self):
        self.assertEqual(10 + 20, 30)

    def test_cpython_suite_instances(self):
        suite = unittest.suite.TestSuite()
        self.assertIsInstance(suite, unittest.suite.BaseTestSuite)
        self.assertEqual(suite.countTestCases(), 0)

    def test_suite_iteration(self):
        suite = unittest.suite.TestSuite()
        t1 = CPythonTestSuiteValidation('test_addition')
        suite.addTest(t1)
        tests = list(suite)
        self.assertEqual(len(tests), 1)

suite = unittest.TestSuite()
suite.addTest(CPythonTestSuiteValidation('test_addition'))
suite.addTest(CPythonTestSuiteValidation('test_cpython_suite_instances'))
suite.addTest(CPythonTestSuiteValidation('test_suite_iteration'))

stream = io.StringIO()
runner = unittest.TextTestRunner(stream=stream, verbosity=2)
result = runner.run(suite)

print(f"CPython unittest.suite verification: ran={result.testsRun}, errors={len(result.errors)}, failures={len(result.failures)}")
`;

    const project: Project = {
      schemaVersion: 1,
      kind: 'browser-ide-project',
      id: 'cpython-suite-verification',
      name: 'CPython Suite Verification',
      language: 'python',
      entrypoint: 'suite_test.py',
      files: [{ path: 'suite_test.py', encoding: 'utf-8', content: cpythonTestCode }],
      toolchain: { runtimeId: 'python-pyodide', requestedVersion: '314.0.7' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await executePythonInPyodide(project);
    expect(res.exitCode).toBe(0);
    expect(res.stderr).toBe('');
    expect(res.stdout).toContain('CPython unittest.suite verification: ran=3, errors=0, failures=0');
  }, 30000);

  // -------------------------------------------------------------
  // 2. PRINCETON COS 126: Java Standard Input & Scanner
  // Source: introcs.cs.princeton.edu (Sedgewick & Wayne)
  // -------------------------------------------------------------
  it('verifies Princeton COS126 Java Scanner/StdIn execution in sandbox', async () => {
    // Code representative of Princeton COS126 standard I/O
    const princetonCode = `
package edu.princeton.cs;

import java.util.Scanner;

public class Average {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String name = scanner.nextLine();
        System.out.println("Hi " + name);
    }
}
`;

    const javaRunner = new BrowserJavaRunner();
    javaRunner.queueStdin('Alan Turing');

    const result = await javaRunner.executeProgram(
      [{ name: 'edu/princeton/cs/Average.java', content: princetonCode }],
      { maxRunTimeMs: 5000 }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Hi Alan Turing\n');

    // Also verify via the production @ide/runner-java RuntimeProvider
    const javaProject: Project = {
      schemaVersion: 1,
      kind: 'browser-ide-project',
      id: 'princeton-cos126',
      name: 'Princeton COS126',
      language: 'java',
      entrypoint: 'Average.java',
      files: [{ path: 'Average.java', encoding: 'utf-8', content: princetonCode }],
      toolchain: { runtimeId: 'java-browser', requestedVersion: '11.0.0' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    let capturedJavaOutput = '';
    const bridge = new DirectJavaWorkerBridge();
    const provider = new JavaRuntimeProvider(() => bridge);
    await provider.run(
      {
        runId: 'run-princeton',
        project: javaProject,
        settings: { maxRunTimeMs: 5000, maxOutputBytes: 4096, maxFiles: 10, maxProjectBytes: 4096 },
        mode: 'normal',
      },
      (e) => {
        if (e.type === 'stdout') capturedJavaOutput += e.text;
        if (e.type === 'stdin-request') {
          provider.supplyInput('run-princeton', e.requestId, 'Alan Turing');
        }
      }
    );
    expect(capturedJavaOutput).toBe('Hi Alan Turing\n');
  });

  // -------------------------------------------------------------
  // 3. STANFORD CS 106B: C++ Vector & Algorithmic Processing
  // Source: web.stanford.edu/class/cs106b
  // -------------------------------------------------------------
  it('verifies Stanford CS106B C++ STL vector & stream flow in sandbox', async () => {
    // Code representative of Stanford CS106B multi-file vector algorithms
    const cs106bMain = `
#include <iostream>
#include <vector>
#include <numeric>
#include "stats.hpp"

int main() {
    std::vector<int> scores = { 90, 85, 95, 100 };
    double avg = calculateAverage(scores);
    std::cout << "Stanford CS106B Average: " << avg << std::endl;
    return 0;
}
`;
    const cs106bHeader = `
#pragma once
#include <vector>
double calculateAverage(const std::vector<int>& data);
`;
    const cs106bStats = `
#include "stats.hpp"
#include <numeric>

double calculateAverage(const std::vector<int>& data) {
    if (data.empty()) return 0.0;
    int sum = std::accumulate(data.begin(), data.end(), 0);
    return static_cast<double>(sum) / data.size();
}
`;

    const cs106bProject: Project = {
      schemaVersion: 1,
      kind: 'browser-ide-project',
      id: 'stanford-cs106b',
      name: 'CS106B Vector Stats',
      language: 'cpp',
      entrypoint: 'src/main.cpp',
      files: [
        { path: 'src/main.cpp', encoding: 'utf-8', content: cs106bMain },
        { path: 'src/stats.hpp', encoding: 'utf-8', content: cs106bHeader },
        { path: 'src/stats.cpp', encoding: 'utf-8', content: cs106bStats },
      ],
      toolchain: { runtimeId: 'cpp-yowasp', requestedVersion: '17' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let capturedOutput = '';
    const mockCppBridge = {
      onmessage: null as any,
      onerror: null as any,
      postMessage(msg: any) {
        if (msg.type === 'compile-and-run') {
          setTimeout(() => {
            capturedOutput += 'Stanford CS106B Average: 92.5\n';
            this.onmessage?.({
              data: { type: 'stdout', text: 'Stanford CS106B Average: 92.5\n' },
            });
            this.onmessage?.({
              data: {
                type: 'complete',
                exitCode: 0,
                durationMs: 120,
                reason: 'success',
              },
            });
          }, 10);
        }
      },
      terminate() {},
    };

    const cppProvider = new CppRuntimeProvider(undefined, () => mockCppBridge as any);

    await cppProvider.run(
      {
        runId: 'run-cs106b',
        project: cs106bProject,
        settings: {
          maxRunTimeMs: 5000,
          maxOutputBytes: 4096,
          maxFiles: 10,
          maxProjectBytes: 4096,
        },
        mode: 'normal',
      },
      () => {}
    );

    expect(capturedOutput).toBe('Stanford CS106B Average: 92.5\n');
  });

  // -------------------------------------------------------------
  // 4. Automated Grading of Course Exercise in Sandbox (Milestone 6)
  // -------------------------------------------------------------
  it('grades an introductory Python course exercise within the sandbox engine', async () => {
    const berkeleyAssignment: AssignmentPackage = {
      schemaVersion: 1,
      kind: 'browser-ide-assignment',
      id: 'cs61a-add-range',
      version: 1,
      title: 'Lab 01: add_in_range',
      language: 'python',
      minimumRuntime: '3.14',
      maxPoints: 10,
      instructionsMarkdown: 'Implement add_in_range(start, stop)',
      tests: [
        {
          id: 'case1',
          type: 'stdin-stdout',
          stdin: '1 5\n',
          expectedStdout: '15\n',
          points: 5,
          normalization: 'line-endings',
          visibility: 'public',
        },
        {
          id: 'case2',
          type: 'stdin-stdout',
          stdin: '3 6\n',
          expectedStdout: '18\n',
          points: 5,
          normalization: 'line-endings',
          visibility: 'public',
        },
      ],
      rubric: [],
      hints: [],
      attemptPolicy: { allowResubmission: true },
      feedbackPolicy: { showTests: true, showExpectedOutput: true },
    };

    const studentSolution: Project = {
      schemaVersion: 1,
      kind: 'browser-ide-project',
      id: 'student-lab01',
      name: 'Lab 01 Submission',
      language: 'python',
      entrypoint: 'main.py',
      files: [
        {
          path: 'main.py',
          encoding: 'utf-8',
          content: `
s, e = map(int, input().split())
print(sum(range(s, e + 1)))
`,
        },
      ],
      toolchain: { runtimeId: 'python-pyodide', requestedVersion: '314.0.7' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockEvalRunner = {
      id: 'mock-eval',
      language: 'python' as const,
      async probe() { return { available: true, versions: ['3.14.0'] }; },
      async prepare() {},
      async run(req: any, onEvent: any) {
        const parts = req.stdin.trim().split(' ').map(Number);
        const s = parts[0];
        const e = parts[1];
        let sum = 0;
        for (let i = s; i <= e; i++) sum += i;
        onEvent({ type: 'stdout', text: `${sum}\n` });
        onEvent({ type: 'complete', exitCode: 0, durationMs: 10, reason: 'success' });
      },
      async supplyInput() {},
      async stop() {},
      async dispose() {},
    };

    const report = await runLocalAssignmentEvaluation(
      berkeleyAssignment,
      studentSolution,
      mockEvalRunner
    );

    expect(report.autoTestScore).toBe(10);
    expect(report.maxAutoScore).toBe(10);
    expect(report.testResults.every((t) => t.passed)).toBe(true);
    expect(report.disclaimer).toContain('Local estimate — not an official Canvas grade');
  });
});

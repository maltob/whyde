import { describe, it, expect } from 'vitest';
import {
  AssignmentPackage,
  runLocalAssignmentEvaluation,
  normalizeOutput,
} from './index.js';
import { Project } from '@ide/project-model';
import { RuntimeProvider } from '@ide/execution-contracts';

describe('Assignment Model & Evaluation (Milestone 6 - IDE-015/016)', () => {
  const sampleAssignment: AssignmentPackage = {
    schemaVersion: 1,
    kind: 'browser-ide-assignment',
    id: 'intro-greeting',
    version: 1,
    title: 'Greeting Program',
    language: 'python',
    minimumRuntime: '3.14',
    maxPoints: 10,
    instructionsMarkdown: 'Read a name and print a greeting.',
    tests: [
      {
        id: 't1',
        type: 'stdin-stdout',
        stdin: 'Ava\n',
        expectedStdout: 'Hello Ava\n',
        points: 6,
        normalization: 'line-endings',
        visibility: 'public',
      },
    ],
    rubric: [
      {
        id: 'r1',
        title: 'Readability',
        points: 4,
        description: 'Clear naming and structure',
        scoring: 'manual',
      },
    ],
    hints: [{ id: 'h1', text: 'Use input() to read a name.' }],
    attemptPolicy: { allowResubmission: true },
    feedbackPolicy: { showTests: true, showExpectedOutput: true },
  };

  const passingProject: Project = {
    schemaVersion: 1,
    kind: 'browser-ide-project',
    id: 'student-proj-1',
    name: 'Greeting Solution',
    language: 'python',
    entrypoint: 'src/main.py',
    files: [
      {
        path: 'src/main.py',
        encoding: 'utf-8',
        content: 'name = input()\nprint(f"Hello {name}")\n',
      },
    ],
    toolchain: { runtimeId: 'python-pyodide', requestedVersion: '314.0.7' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('normalizes line endings across platforms', () => {
    const crlf = 'Line 1\r\nLine 2\r\n';
    const lf = 'Line 1\nLine 2\n';
    expect(normalizeOutput(crlf, 'line-endings')).toBe(lf);
  });

  it('evaluates student solution and generates local advisory grading report', async () => {
    const mockRunner: RuntimeProvider = {
      id: 'mock-runner',
      language: 'python',
      async probe() {
        return { available: true, versions: ['3.14.0'] };
      },
      async prepare() {},
      async run(req, onEvent) {
        // Echo greeting based on stdin
        const name = req.stdin ? req.stdin.trim() : 'Unknown';
        onEvent({ type: 'stdout', text: `Hello ${name}\n` });
        onEvent({
          type: 'complete',
          exitCode: 0,
          durationMs: 15,
          reason: 'success',
        });
      },
      async supplyInput() {},
      async stop() {},
      async dispose() {},
    };

    const report = await runLocalAssignmentEvaluation(
      sampleAssignment,
      passingProject,
      mockRunner
    );

    expect(report.assignmentId).toBe('intro-greeting');
    expect(report.autoTestScore).toBe(6);
    expect(report.maxAutoScore).toBe(6);
    expect(report.rubricMaxScore).toBe(4);
    expect(report.testResults[0].passed).toBe(true);
    expect(report.disclaimer).toContain('Local estimate — not an official Canvas grade');
  });
});

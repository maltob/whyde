import { z } from 'zod';
import { Project, LanguageIdSchema } from '@ide/project-model';
import { RuntimeProvider, RunRequest, RuntimeEvent } from '@ide/execution-contracts';

export const TestCaseSchema = z.object({
  id: z.string().min(1),
  type: z.literal('stdin-stdout').default('stdin-stdout'),
  stdin: z.string().default(''),
  expectedStdout: z.string(),
  points: z.number().nonnegative(),
  normalization: z.enum(['exact', 'line-endings', 'trim-whitespace']).default('line-endings'),
  visibility: z.enum(['public', 'hidden']).default('public'),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

export const RubricItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  points: z.number().nonnegative(),
  description: z.string().default(''),
  scoring: z.literal('manual').default('manual'),
});
export type RubricItem = z.infer<typeof RubricItemSchema>;

export const AssignmentPackageSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('browser-ide-assignment').default('browser-ide-assignment'),
  id: z.string().min(1),
  version: z.number().int().positive(),
  title: z.string().min(1),
  language: LanguageIdSchema,
  minimumRuntime: z.string().min(1),
  maxPoints: z.number().positive(),
  instructionsMarkdown: z.string(),
  tests: z.array(TestCaseSchema),
  rubric: z.array(RubricItemSchema).default([]),
  hints: z.array(z.object({ id: z.string(), text: string() })).default([]),
  attemptPolicy: z
    .object({
      allowResubmission: z.boolean().default(true),
    })
    .default({ allowResubmission: true }),
  feedbackPolicy: z
    .object({
      showTests: z.boolean().default(true),
      showExpectedOutput: z.boolean().default(true),
    })
    .default({ showTests: true, showExpectedOutput: true }),
});
export type AssignmentPackage = z.infer<typeof AssignmentPackageSchema>;

function string() {
  return z.string();
}

export interface TestResult {
  testId: string;
  passed: boolean;
  pointsAwarded: number;
  actualStdout: string;
  expectedStdout: string;
  durationMs: number;
  error?: string;
}

export interface LocalGradingReport {
  assignmentId: string;
  autoTestScore: number;
  maxAutoScore: number;
  rubricMaxScore: number;
  testResults: TestResult[];
  timestamp: string;
  disclaimer: string;
}

export function normalizeOutput(text: string, mode: 'exact' | 'line-endings' | 'trim-whitespace'): string {
  if (mode === 'exact') return text;
  // Normalize Windows/Unix line endings
  let normalized = text.replace(/\r\n/g, '\n');
  if (mode === 'trim-whitespace') {
    normalized = normalized
      .split('\n')
      .map((l) => l.trimEnd())
      .join('\n')
      .trim();
  }
  return normalized;
}

export async function runLocalAssignmentEvaluation(
  assignment: AssignmentPackage,
  project: Project,
  runner: RuntimeProvider
): Promise<LocalGradingReport> {
  const testResults: TestResult[] = [];
  let autoScore = 0;
  let maxAutoScore = 0;

  for (const t of assignment.tests) {
    maxAutoScore += t.points;

    let capturedStdout = '';
    let capturedStderr = '';
    const startTime = Date.now();

    const runReq: RunRequest = {
      runId: `eval-${t.id}-${Date.now()}`,
      project,
      stdin: t.stdin,
      settings: {
        maxRunTimeMs: 10000,
        maxOutputBytes: 1024 * 1024,
        maxFiles: 50,
        maxProjectBytes: 1024 * 1024,
      },
      mode: 'test',
    };

    let runError: string | undefined;

    await runner.run(runReq, (event: RuntimeEvent) => {
      if (event.type === 'stdout') {
        capturedStdout += event.text;
      } else if (event.type === 'stderr') {
        capturedStderr += event.text;
      } else if (event.type === 'stdin-request') {
        runner.supplyInput(runReq.runId, event.requestId, t.stdin || '');
      } else if (event.type === 'complete' && event.reason !== 'success') {
        runError = `Execution terminated: ${event.reason}`;
      }
    });

    const normalizedActual = normalizeOutput(capturedStdout, t.normalization);
    const normalizedExpected = normalizeOutput(t.expectedStdout, t.normalization);

    const passed = !runError && normalizedActual === normalizedExpected;
    const pointsAwarded = passed ? t.points : 0;
    autoScore += pointsAwarded;

    testResults.push({
      testId: t.id,
      passed,
      pointsAwarded,
      actualStdout: capturedStdout,
      expectedStdout: t.expectedStdout,
      durationMs: Date.now() - startTime,
      error: runError || (capturedStderr.length > 0 ? capturedStderr : undefined),
    });
  }

  const rubricScore = assignment.rubric.reduce((acc, r) => acc + r.points, 0);

  return {
    assignmentId: assignment.id,
    autoTestScore: autoScore,
    maxAutoScore,
    rubricMaxScore: rubricScore,
    testResults,
    timestamp: new Date().toISOString(),
    disclaimer: 'Local estimate — not an official Canvas grade',
  };
}

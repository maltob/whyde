import { z } from 'zod';

export const LanguageIdSchema = z.enum(['python', 'java', 'cpp', 'javascript']);
export type LanguageId = z.infer<typeof LanguageIdSchema>;

export const ProjectFileSchema = z.object({
  path: z.string().min(1).refine((p) => !p.startsWith('/') && !p.startsWith('\\') && !p.includes('..') && !p.includes('\0'), {
    message: 'File path must be normalized, relative, not contain parent directory (..) or null bytes',
  }),
  encoding: z.literal('utf-8'),
  content: z.string(),
});
export type ProjectFile = z.infer<typeof ProjectFileSchema>;

export const ToolchainRefSchema = z.object({
  runtimeId: z.string().min(1),
  requestedVersion: z.string().min(1),
});

export const AssignmentRefSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  digest: z.string().min(1),
});

export const ProjectSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('browser-ide-project').default('browser-ide-project'),
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  language: LanguageIdSchema,
  entrypoint: z.string().min(1),
  files: z.array(ProjectFileSchema).min(1),
  toolchain: ToolchainRefSchema,
  assignmentRef: AssignmentRefSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

export function validateProject(data: unknown): { success: true; project: Project } | { success: false; errors: string[] } {
  const result = ProjectSchema.safeParse(data);
  if (result.success) {
    // Also verify entrypoint exists in files
    const hasEntrypoint = result.data.files.some((f) => f.path === result.data.entrypoint);
    if (!hasEntrypoint) {
      return {
        success: false,
        errors: [`Entrypoint '${result.data.entrypoint}' does not match any file path in project`],
      };
    }
    return { success: true, project: result.data };
  } else {
    return {
      success: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }
}

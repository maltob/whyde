import pako from 'pako';
import { Project, validateProject } from '@ide/project-model';

export const MAX_URL_LENGTH = 8192; // 8 KiB conservative limit per Spec Section 9.2
export const MAX_DECOMPRESSED_BYTES = 5 * 1024 * 1024; // 5 MiB uncompressed cap

export interface PortableProjectPayload {
  schemaVersion: 1;
  kind: 'browser-ide-project';
  language: 'python' | 'java' | 'cpp';
  runtime: { id: string; minimum: string };
  name: string;
  entrypoint: string;
  files: { path: string; encoding: 'utf-8'; content: string }[];
  assignmentRef?: { id: string; version: number; digest: string };
}

export function projectToPortablePayload(project: Project): PortableProjectPayload {
  return {
    schemaVersion: 1,
    kind: 'browser-ide-project',
    language: project.language,
    runtime: {
      id: project.toolchain.runtimeId,
      minimum: project.toolchain.requestedVersion,
    },
    name: project.name,
    entrypoint: project.entrypoint,
    files: project.files.map((f) => ({
      path: f.path,
      encoding: 'utf-8',
      content: f.content,
    })),
    assignmentRef: project.assignmentRef,
  };
}

export function toBase64Url(uint8: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64Url(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function exportProjectToUrlHash(project: Project, baseUrl = ''): {
  url: string;
  exceedsUrlLimit: boolean;
  byteLength: number;
} {
  const payload = projectToPortablePayload(project);
  const jsonString = JSON.stringify(payload);
  const compressed = pako.deflate(jsonString);
  const encoded = toBase64Url(compressed);
  const fragment = `#p=v1.${encoded}`;
  const fullUrl = `${baseUrl}?view=project${fragment}`;

  return {
    url: fullUrl,
    exceedsUrlLimit: fullUrl.length > MAX_URL_LENGTH,
    byteLength: fullUrl.length,
  };
}

export function importProjectFromUrlHash(hash: string): {
  success: boolean;
  project?: Project;
  error?: string;
} {
  try {
    const match = hash.match(/#p=v1\.([A-Za-z0-9_-]+)/);
    if (!match) {
      return { success: false, error: 'Invalid URL snapshot fragment format' };
    }

    const compressed = fromBase64Url(match[1]);
    const decompressed = pako.inflate(compressed, { to: 'string' });

    if (decompressed.length > MAX_DECOMPRESSED_BYTES) {
      return { success: false, error: 'Decompressed payload exceeds maximum allowed size' };
    }

    const parsed = JSON.parse(decompressed);

    // Convert portable payload back to full Project schema
    const projectCandidate: Project = {
      schemaVersion: 1,
      kind: 'browser-ide-project',
      id: `imported-${Date.now()}`,
      name: parsed.name,
      language: parsed.language,
      entrypoint: parsed.entrypoint,
      files: parsed.files,
      toolchain: {
        runtimeId: parsed.runtime?.id || `${parsed.language}-default`,
        requestedVersion: parsed.runtime?.minimum || 'latest',
      },
      assignmentRef: parsed.assignmentRef,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validation = validateProject(projectCandidate);
    if (!validation.success) {
      return { success: false, error: `Invalid project schema: ${validation.errors.join(', ')}` };
    }

    return { success: true, project: projectCandidate };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to decode URL snapshot' };
  }
}

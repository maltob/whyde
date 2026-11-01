export interface IntegrationCapabilities {
  supportsLti: boolean;
  supportsGradePassback: boolean;
  supportsRemoteGrading: boolean;
  mode: 'local-only' | 'canvas-connected';
}

export interface VerifiedLtiContext {
  userId: string;
  courseId: string;
  assignmentId: string;
  lineItemUrl?: string;
  roles: string[];
}

export interface SubmissionPackage {
  projectId: string;
  assignmentId: string;
  sourceBlob: Blob;
  manifestSha256: string;
}

export interface SubmissionReceipt {
  receiptId: string;
  timestamp: string;
  status: 'accepted' | 'pending' | 'grade-posted';
  advisoryOnly: boolean;
}

export interface IntegrationProvider {
  readonly id: string;
  discover(): Promise<IntegrationCapabilities>;
  currentContext(): Promise<VerifiedLtiContext | null>;
  submit?(submission: SubmissionPackage): Promise<SubmissionReceipt>;
}

/**
 * Standard default provider for all static builds.
 * Guarantees zero remote network requests, offline-first behavior, and explicit local badge.
 */
export class LocalOnlyProvider implements IntegrationProvider {
  readonly id = 'local-only-provider';

  async discover(): Promise<IntegrationCapabilities> {
    return {
      supportsLti: false,
      supportsGradePassback: false,
      supportsRemoteGrading: false,
      mode: 'local-only',
    };
  }

  async currentContext(): Promise<VerifiedLtiContext | null> {
    return null;
  }
}

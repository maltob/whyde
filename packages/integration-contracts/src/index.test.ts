import { describe, it, expect } from 'vitest';
import { LocalOnlyProvider } from './index.js';

describe('LocalOnlyProvider (Spec Section 5)', () => {
  it('returns local-only capabilities with zero remote features enabled', async () => {
    const provider = new LocalOnlyProvider();
    const caps = await provider.discover();

    expect(caps.mode).toBe('local-only');
    expect(caps.supportsLti).toBe(false);
    expect(caps.supportsGradePassback).toBe(false);
    expect(caps.supportsRemoteGrading).toBe(false);

    const ctx = await provider.currentContext();
    expect(ctx).toBeNull();
  });
});

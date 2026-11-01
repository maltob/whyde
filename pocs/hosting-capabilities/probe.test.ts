import { describe, it, expect } from 'vitest';
import { probeCapabilities } from './probe.js';

describe('Hosting Capabilities Probe (POC-A)', () => {
  it('probes baseline environment capabilities', async () => {
    const results = await probeCapabilities();
    expect(results.length).toBeGreaterThanOrEqual(5);

    const wasm = results.find((r) => r.capability.includes('WebAssembly'));
    expect(wasm).toBeDefined();
    expect(wasm?.status).toBe('pass');

    const sab = results.find((r) => r.capability.includes('SharedArrayBuffer'));
    expect(sab).toBeDefined();
    // Non-isolated by default in normal test environment
    expect(['pass', 'optional-unsupported']).toContain(sab?.status);
  });
});

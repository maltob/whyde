import { describe, it, expect } from 'vitest';
import { runJavaComparison } from './compare-options.js';

describe('Java In-Browser Runner Comparison & Feasibility Benchmark', () => {
  it('evaluates all 3 architectural options across sample student projects', async () => {
    const results = await runJavaComparison();
    expect(results.length).toBe(3);

    console.log('\n================================================================================');
    console.log('       JAVA IN-BROWSER ARCHITECTURAL COMPARISON & FEASIBILITY MATRIX');
    console.log('================================================================================\n');

    for (const res of results) {
      console.log(`>>> ${res.option}`);
      console.log(`    Architecture:    ${res.architecture}`);
      console.log(`    Bundle/Download: ${res.bundleSizeEstimated}`);
      console.log(`    Cold Start Time: ${res.coldStartTimeMs} ms\n`);
      console.log('    Test Results:');
      for (const t of res.testResults) {
        const mark = t.supported ? '✓ PASS' : '✗ FAIL';
        console.log(`      [${mark}] ${t.projectName.padEnd(35)} (${t.durationMs}ms) - ${t.notes}`);
      }
      console.log('--------------------------------------------------------------------------------\n');
    }
  });
});

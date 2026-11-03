import { describe, it, expect } from 'vitest';
import { parseHashString } from './hashParams.js';

describe('parseHashString', () => {
  it('parses empty hash', () => {
    const res = parseHashString('');
    expect(res).toEqual({});
  });

  it('parses language, highlight off, and active file', () => {
    const res = parseHashString('#lang=cpp&highlight=off&file=src/stats.hpp');
    expect(res.lang).toBe('cpp');
    expect(res.highlight).toBe(false);
    expect(res.file).toBe('src/stats.hpp');
  });

  it('parses highlight on and java project', () => {
    const res = parseHashString('#project=java&highlight=on');
    expect(res.lang).toBe('java');
    expect(res.highlight).toBe(true);
  });
});

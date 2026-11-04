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
    const res = parseHashString('#project=java&highlight=on&blank=true&hideNewProject=true');
    expect(res.lang).toBe('java');
    expect(res.highlight).toBe(true);
    expect(res.blank).toBe(true);
    expect(res.hideNewProject).toBe(true);
  });

  it('parses codeSuggest hash option', () => {
    const res1 = parseHashString('#codeSuggest=1');
    expect(res1.codeSuggest).toBe(true);

    const res0 = parseHashString('#codeSuggest=0');
    expect(res0.codeSuggest).toBe(false);

    const resAlias = parseHashString('#suggest=false');
    expect(resAlias.codeSuggest).toBe(false);
  });
});

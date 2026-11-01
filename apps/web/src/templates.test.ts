import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { STARTER_PROJECTS } from './templates.js';
import { validateProject } from '@ide/project-model';

describe('Web App Starter Templates (Milestone 1)', () => {
  it('provides valid starter template for Python', () => {
    const pythonProj = STARTER_PROJECTS.python();
    expect(pythonProj.language).toBe('python');
    const valid = validateProject(pythonProj);
    expect(valid.success).toBe(true);
  });

  it('provides valid starter template for Java', () => {
    const javaProj = STARTER_PROJECTS.java();
    expect(javaProj.language).toBe('java');
    const valid = validateProject(javaProj);
    expect(valid.success).toBe(true);
    expect(javaProj.files.length).toBeGreaterThanOrEqual(2);
  });

  it('provides valid starter template for C++', () => {
    const cppProj = STARTER_PROJECTS.cpp();
    expect(cppProj.language).toBe('cpp');
    const valid = validateProject(cppProj);
    expect(valid.success).toBe(true);
    expect(cppProj.files.length).toBeGreaterThanOrEqual(3);
  });
});

import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { STARTER_PROJECTS, BLANK_PROJECTS } from './templates.js';
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

  it('provides valid blank templates for student exercises', () => {
    const pyBlank = BLANK_PROJECTS.python();
    expect(validateProject(pyBlank).success).toBe(true);
    expect(pyBlank.files[0].content).toBe('');

    const javaBlank = BLANK_PROJECTS.java();
    expect(validateProject(javaBlank).success).toBe(true);
    expect(javaBlank.files[0].content).toContain('class Main');

    const cppBlank = BLANK_PROJECTS.cpp();
    expect(validateProject(cppBlank).success).toBe(true);
    expect(cppBlank.files[0].content).toContain('int main()');
  });
});

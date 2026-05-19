import { buildSystemPrompt, buildCVContext } from './prompts';
import { CVProfile } from '../types/cv.types';

const mockCV: CVProfile = {
  name: 'John Doe',
  currentRole: 'Software Engineer',
  yearsExperience: 5,
  skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
  companies: [
    {
      name: 'Acme Corp',
      role: 'Backend Engineer',
      duration: 'Jan 2020 - Present',
      achievements: ['Reduced API latency by 40%', 'Led migration to microservices'],
    },
  ],
  projects: [
    {
      name: 'ZoomGuru',
      description: 'AI interview copilot',
      stack: ['Electron', 'NestJS', 'Neon'],
      impact: '500 beta users',
    },
  ],
  education: [
    { institution: 'MIT', degree: 'BSc Computer Science', year: '2019' },
  ],
  certifications: ['AWS Solutions Architect'],
  summary: 'Experienced backend engineer.',
};

describe('buildCVContext', () => {
  it('includes candidate name', () => {
    const ctx = buildCVContext(mockCV);
    expect(ctx).toContain('John Doe');
  });

  it('includes current role', () => {
    const ctx = buildCVContext(mockCV);
    expect(ctx).toContain('Software Engineer');
  });

  it('includes all skills', () => {
    const ctx = buildCVContext(mockCV);
    expect(ctx).toContain('TypeScript');
    expect(ctx).toContain('Node.js');
    expect(ctx).toContain('PostgreSQL');
  });

  it('includes company and achievement', () => {
    const ctx = buildCVContext(mockCV);
    expect(ctx).toContain('Acme Corp');
    expect(ctx).toContain('Reduced API latency by 40%');
  });

  it('includes project details', () => {
    const ctx = buildCVContext(mockCV);
    expect(ctx).toContain('ZoomGuru');
    expect(ctx).toContain('500 beta users');
  });

  it('includes education', () => {
    const ctx = buildCVContext(mockCV);
    expect(ctx).toContain('MIT');
    expect(ctx).toContain('BSc Computer Science');
  });

  it('includes certifications', () => {
    const ctx = buildCVContext(mockCV);
    expect(ctx).toContain('AWS Solutions Architect');
  });
});

describe('buildSystemPrompt', () => {
  it('includes candidate name in system prompt', () => {
    const prompt = buildSystemPrompt('technical', mockCV);
    expect(prompt).toContain('John Doe');
  });

  it('behavioral prompt mentions STAR', () => {
    const prompt = buildSystemPrompt('behavioral', mockCV);
    expect(prompt.toUpperCase()).toContain('STAR');
  });

  it('coding prompt mentions complexity', () => {
    const prompt = buildSystemPrompt('coding', mockCV);
    expect(prompt.toLowerCase()).toContain('complexity');
  });

  it('systemdesign prompt mentions architecture', () => {
    const prompt = buildSystemPrompt('systemdesign', mockCV);
    expect(prompt.toLowerCase()).toContain('architect');
  });

  it('math prompt mentions step', () => {
    const prompt = buildSystemPrompt('math', mockCV);
    expect(prompt.toLowerCase()).toContain('step');
  });

  it('unknown promptKey falls back to technical format', () => {
    const prompt = buildSystemPrompt('unknown_key', mockCV);
    expect(prompt).toContain('John Doe');
  });

  it('brief length instruction is injected', () => {
    const prompt = buildSystemPrompt('technical', mockCV, undefined, 'brief');
    expect(prompt.toLowerCase()).toContain('3 sentences');
  });

  it('detailed length instruction is injected', () => {
    const prompt = buildSystemPrompt('technical', mockCV, undefined, 'detailed');
    expect(prompt.toLowerCase()).toContain('thorough');
  });

  it('job description is included when provided', () => {
    const prompt = buildSystemPrompt('technical', mockCV, 'We need a Node.js expert');
    expect(prompt).toContain('We need a Node.js expert');
  });

  it('no job description context when omitted', () => {
    const prompt = buildSystemPrompt('technical', mockCV);
    expect(prompt).not.toContain('JOB DESCRIPTION');
  });

  it('instructs AI to speak in first person as candidate', () => {
    const prompt = buildSystemPrompt('technical', mockCV);
    expect(prompt).toContain('first person');
  });

  it('instructs AI not to fabricate experience', () => {
    const prompt = buildSystemPrompt('behavioral', mockCV);
    expect(prompt.toLowerCase()).toContain('fabricat');
  });
});

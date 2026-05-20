// Surgical unit tests for CV profile validation and fallback logic
// Extended coverage beyond cv-sanitize.spec.ts — focuses on validateAndFillDefaults
// and buildFallbackProfile edge cases

function validateAndFillDefaults(parsed: any) {
  return {
    name: parsed.name || 'Candidate',
    currentRole: parsed.currentRole || parsed.current_role || 'Professional',
    yearsExperience: typeof parsed.yearsExperience === 'number' ? parsed.yearsExperience : 0,
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    companies: Array.isArray(parsed.companies)
      ? parsed.companies.map((c: any) => ({
          name: c.name || '',
          role: c.role || '',
          duration: c.duration || '',
          achievements: Array.isArray(c.achievements) ? c.achievements : [],
        }))
      : [],
    projects: Array.isArray(parsed.projects)
      ? parsed.projects.map((p: any) => ({
          name: p.name || '',
          description: p.description || '',
          stack: Array.isArray(p.stack) ? p.stack : [],
          impact: p.impact || '',
        }))
      : [],
    education: Array.isArray(parsed.education)
      ? parsed.education.map((e: any) => ({
          institution: e.institution || '',
          degree: e.degree || '',
          year: e.year || '',
        }))
      : [],
    certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
    summary: parsed.summary || '',
  };
}

function buildFallbackProfile(rawText: string) {
  const lines = rawText.split('\n').filter(l => l.trim());
  const name = lines[0]?.trim() || 'Candidate';
  return {
    name,
    currentRole: 'Professional',
    yearsExperience: 0,
    skills: [],
    companies: [],
    projects: [],
    education: [],
    certifications: [],
    summary: rawText.slice(0, 500),
  };
}

function isCVTextSufficient(text: string, minLength = 50): boolean {
  return text.trim().length >= minLength;
}

function isSupportedFileType(mimetype: string, filename: string): boolean {
  const supported = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  if (supported.includes(mimetype)) return true;
  if (filename.endsWith('.pdf')) return true;
  if (filename.endsWith('.docx')) return true;
  if (filename.endsWith('.txt')) return true;
  return false;
}

// ── validateAndFillDefaults ───────────────────────────────────────────────────

describe('validateAndFillDefaults', () => {
  it('fills name from parsed.name', () => {
    expect(validateAndFillDefaults({ name: 'Alice Johnson' }).name).toBe('Alice Johnson');
  });

  it('defaults name to "Candidate" when missing', () => {
    expect(validateAndFillDefaults({}).name).toBe('Candidate');
  });

  it('accepts currentRole from camelCase', () => {
    expect(validateAndFillDefaults({ currentRole: 'Senior Dev' }).currentRole).toBe('Senior Dev');
  });

  it('falls back to current_role snake_case', () => {
    expect(validateAndFillDefaults({ current_role: 'Backend Dev' }).currentRole).toBe('Backend Dev');
  });

  it('defaults currentRole to "Professional"', () => {
    expect(validateAndFillDefaults({}).currentRole).toBe('Professional');
  });

  it('keeps valid yearsExperience number', () => {
    expect(validateAndFillDefaults({ yearsExperience: 7 }).yearsExperience).toBe(7);
  });

  it('defaults yearsExperience to 0 for string', () => {
    expect(validateAndFillDefaults({ yearsExperience: '5 years' }).yearsExperience).toBe(0);
  });

  it('defaults yearsExperience to 0 when missing', () => {
    expect(validateAndFillDefaults({}).yearsExperience).toBe(0);
  });

  it('keeps valid skills array', () => {
    expect(validateAndFillDefaults({ skills: ['TypeScript', 'SQL'] }).skills).toEqual(['TypeScript', 'SQL']);
  });

  it('converts null skills to empty array', () => {
    expect(validateAndFillDefaults({ skills: null }).skills).toEqual([]);
  });

  it('converts skills string to empty array (not array)', () => {
    expect(validateAndFillDefaults({ skills: 'TypeScript' }).skills).toEqual([]);
  });

  it('normalises company objects', () => {
    const result = validateAndFillDefaults({
      companies: [{ name: 'Acme', role: 'Dev', duration: '2022-present', achievements: ['Led team'] }],
    });
    expect(result.companies[0].achievements).toEqual(['Led team']);
  });

  it('fills missing company fields with empty strings', () => {
    const result = validateAndFillDefaults({ companies: [{}] });
    expect(result.companies[0]).toEqual({ name: '', role: '', duration: '', achievements: [] });
  });

  it('converts non-array companies to empty array', () => {
    expect(validateAndFillDefaults({ companies: 'Acme' }).companies).toEqual([]);
  });

  it('normalises project stack to empty array when missing', () => {
    const result = validateAndFillDefaults({ projects: [{ name: 'P1', description: 'desc' }] });
    expect(result.projects[0].stack).toEqual([]);
  });

  it('normalises certifications', () => {
    expect(validateAndFillDefaults({ certifications: ['AWS', 'GCP'] }).certifications).toEqual(['AWS', 'GCP']);
  });

  it('defaults certifications to empty array', () => {
    expect(validateAndFillDefaults({}).certifications).toEqual([]);
  });

  it('preserves summary', () => {
    expect(validateAndFillDefaults({ summary: 'Experienced dev.' }).summary).toBe('Experienced dev.');
  });

  it('defaults summary to empty string', () => {
    expect(validateAndFillDefaults({}).summary).toBe('');
  });
});

// ── buildFallbackProfile ──────────────────────────────────────────────────────

describe('buildFallbackProfile', () => {
  it('extracts name from first non-empty line', () => {
    const text = 'John Smith\nSoftware Engineer\nSkills: TypeScript';
    expect(buildFallbackProfile(text).name).toBe('John Smith');
  });

  it('uses "Candidate" when text is empty', () => {
    expect(buildFallbackProfile('').name).toBe('Candidate');
  });

  it('truncates summary to 500 chars', () => {
    const long = 'x'.repeat(600);
    expect(buildFallbackProfile(long).summary).toHaveLength(500);
  });

  it('keeps summary under 500 chars intact', () => {
    const short = 'Short CV text.';
    expect(buildFallbackProfile(short).summary).toBe(short);
  });

  it('always has empty arrays for all array fields', () => {
    const profile = buildFallbackProfile('Name\nRole');
    expect(profile.skills).toEqual([]);
    expect(profile.companies).toEqual([]);
    expect(profile.projects).toEqual([]);
    expect(profile.education).toEqual([]);
    expect(profile.certifications).toEqual([]);
  });

  it('always sets yearsExperience to 0', () => {
    expect(buildFallbackProfile('some text').yearsExperience).toBe(0);
  });

  it('handles text with only whitespace lines', () => {
    const whitespace = '\n  \n\t\n';
    expect(buildFallbackProfile(whitespace).name).toBe('Candidate');
  });
});

// ── isCVTextSufficient ────────────────────────────────────────────────────────

describe('isCVTextSufficient', () => {
  it('accepts text of exactly 50 chars', () => {
    expect(isCVTextSufficient('x'.repeat(50))).toBe(true);
  });

  it('rejects text under 50 chars', () => {
    expect(isCVTextSufficient('too short')).toBe(false);
  });

  it('rejects empty text', () => {
    expect(isCVTextSufficient('')).toBe(false);
  });

  it('whitespace-only does not count toward length', () => {
    expect(isCVTextSufficient('   '.padEnd(60))).toBe(false);
  });
});

// ── file type support ─────────────────────────────────────────────────────────

describe('isSupportedFileType', () => {
  it('accepts application/pdf mimetype', () => {
    expect(isSupportedFileType('application/pdf', 'cv.pdf')).toBe(true);
  });

  it('accepts .docx mimetype', () => {
    expect(isSupportedFileType(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'cv.docx'
    )).toBe(true);
  });

  it('accepts text/plain mimetype', () => {
    expect(isSupportedFileType('text/plain', 'cv.txt')).toBe(true);
  });

  it('accepts .pdf by extension even with wrong mimetype', () => {
    expect(isSupportedFileType('application/octet-stream', 'cv.pdf')).toBe(true);
  });

  it('accepts .docx by extension fallback', () => {
    expect(isSupportedFileType('application/octet-stream', 'cv.docx')).toBe(true);
  });

  it('accepts .txt by extension fallback', () => {
    expect(isSupportedFileType('application/octet-stream', 'cv.txt')).toBe(true);
  });

  it('rejects unsupported formats', () => {
    expect(isSupportedFileType('image/png', 'photo.png')).toBe(false);
  });

  it('rejects .exe file', () => {
    expect(isSupportedFileType('application/octet-stream', 'virus.exe')).toBe(false);
  });

  it('rejects .xlsx (not docx)', () => {
    expect(isSupportedFileType('application/vnd.ms-excel', 'data.xlsx')).toBe(false);
  });
});

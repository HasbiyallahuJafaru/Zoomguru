import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { getDB } from '../database/db';
import { CVProfile } from '../types/cv.types';

@Injectable()
export class CvService {

  async processCV(
    userId: string,
    fileBuffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<CVProfile> {
    let rawText = '';

    // Extract text based on file type
    if (mimetype === 'application/pdf' || filename.endsWith('.pdf')) {
      rawText = await this.extractPDF(fileBuffer);
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filename.endsWith('.docx')
    ) {
      rawText = await this.extractDOCX(fileBuffer);
    } else if (mimetype === 'text/plain' || filename.endsWith('.txt')) {
      rawText = fileBuffer.toString('utf-8');
    } else {
      throw new BadRequestException('Unsupported file type. Please upload PDF, DOCX, or TXT.');
    }

    rawText = this.sanitizeCVText(rawText);

    if (!rawText || rawText.trim().length < 50) {
      throw new BadRequestException('Could not extract text from CV. Please check the file.');
    }

    // Parse CV with AI
    const parsedProfile = await this.parseWithAI(rawText);

    // Save to database
    const sql = getDB();
    await sql`
      INSERT INTO cv_profiles (user_id, raw_text, parsed_profile, filename)
      VALUES (${userId}, ${rawText}, ${JSON.stringify(parsedProfile)}, ${filename})
      ON CONFLICT (user_id) DO UPDATE
      SET
        raw_text = EXCLUDED.raw_text,
        parsed_profile = EXCLUDED.parsed_profile,
        filename = EXCLUDED.filename,
        updated_at = NOW()
    `;

    return parsedProfile;
  }

  private async extractPDF(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (err) {
      throw new BadRequestException('Failed to parse PDF file');
    }
  }

  private async extractDOCX(buffer: Buffer): Promise<string> {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (err) {
      throw new BadRequestException('Failed to parse DOCX file');
    }
  }

  private async parseWithAI(rawText: string): Promise<CVProfile> {
    const prompt = `Extract structured information from this CV/resume text. Return ONLY a valid JSON object with no markdown, no code blocks, just raw JSON.

Required JSON structure:
{
  "name": "full name",
  "currentRole": "most recent job title",
  "yearsExperience": number,
  "skills": ["skill1", "skill2"],
  "companies": [
    {
      "name": "company name",
      "role": "job title",
      "duration": "e.g. Jan 2022 - Present",
      "achievements": ["achievement 1", "achievement 2"]
    }
  ],
  "projects": [
    {
      "name": "project name",
      "description": "what it does",
      "stack": ["tech1", "tech2"],
      "impact": "measurable outcome or impact"
    }
  ],
  "education": [
    {
      "institution": "university name",
      "degree": "degree type and field",
      "year": "graduation year"
    }
  ],
  "certifications": ["cert1", "cert2"],
  "summary": "2-3 sentence professional summary"
}

CV TEXT:
${rawText.slice(0, 6000)}`;

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'You are a CV parser. Extract structured data from CV text and return ONLY valid JSON. No markdown, no explanation, just the JSON object.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error('AI parsing failed');
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // Clean any accidental markdown
      const cleaned = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      return this.validateAndFillDefaults(parsed);
    } catch (err) {
      // Fallback: return basic profile with raw text as summary
      return this.buildFallbackProfile(rawText);
    }
  }

  private sanitizeCVText(raw: string): string {
    return raw
      // Hard cap to prevent runaway context injection
      .slice(0, 15_000)
      // Remove HTML/XML tags
      .replace(/<[^>]*>/g, ' ')
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove non-printable characters (keep newlines, tabs)
      .replace(/[^\x09\x0A\x0D\x20-\x7E -￿]/g, ' ')
      // Strip known prompt injection patterns
      .replace(/ignore (previous|above|all) instructions?/gi, '[redacted]')
      .replace(/you are now/gi, '[redacted]')
      .replace(/system:/gi, '[redacted]')
      .replace(/assistant:/gi, '[redacted]')
      .replace(/human:/gi, '[redacted]')
      .replace(/<\/?s?ystem>/gi, '[redacted]')
      .replace(/\[INST\]/gi, '[redacted]')
      // Collapse excessive whitespace
      .replace(/\s{4,}/g, '\n\n')
      // Trim
      .trim();
  }

  private validateAndFillDefaults(parsed: any): CVProfile {
    return {
      name: parsed.name || 'Candidate',
      currentRole: parsed.currentRole || parsed.current_role || 'Professional',
      yearsExperience: typeof parsed.yearsExperience === 'number' ? parsed.yearsExperience : 0,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      companies: Array.isArray(parsed.companies) ? parsed.companies.map((c: any) => ({
        name: c.name || '',
        role: c.role || '',
        duration: c.duration || '',
        achievements: Array.isArray(c.achievements) ? c.achievements : [],
      })) : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects.map((p: any) => ({
        name: p.name || '',
        description: p.description || '',
        stack: Array.isArray(p.stack) ? p.stack : [],
        impact: p.impact || '',
      })) : [],
      education: Array.isArray(parsed.education) ? parsed.education.map((e: any) => ({
        institution: e.institution || '',
        degree: e.degree || '',
        year: e.year || '',
      })) : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      summary: parsed.summary || '',
    };
  }

  private buildFallbackProfile(rawText: string): CVProfile {
    // Extract name from first line
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

  async getProfile(userId: string): Promise<CVProfile | null> {
    const sql = getDB();
    const [row] = await sql`
      SELECT parsed_profile, filename, uploaded_at, updated_at
      FROM cv_profiles
      WHERE user_id = ${userId}
    `;

    if (!row) return null;

    return {
      ...row.parsed_profile,
      _meta: {
        filename: row.filename,
        uploadedAt: row.uploaded_at,
        updatedAt: row.updated_at,
      }
    };
  }

  async deleteProfile(userId: string): Promise<void> {
    const sql = getDB();
    const [existing] = await sql`
      SELECT id FROM cv_profiles WHERE user_id = ${userId}
    `;

    if (!existing) throw new NotFoundException('No CV profile found');

    await sql`DELETE FROM cv_profiles WHERE user_id = ${userId}`;
  }
}

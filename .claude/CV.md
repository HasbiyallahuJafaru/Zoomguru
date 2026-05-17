# ZoomGuru — CV Upload & Parsing

## Overview

CV is uploaded once before the first interview. The backend extracts raw text,
then uses DeepSeek V3 to parse it into a structured `CVProfile` JSON object.
This profile is injected into every AI system prompt throughout all sessions.

---

## cv.controller.ts

```typescript
import {
  Controller, Post, Get, Delete,
  UseGuards, Req, Res
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CvService } from './cv.service';
import { FastifyRequest, FastifyReply } from 'fastify';

@Controller('cv')
@UseGuards(JwtAuthGuard)
export class CvController {
  constructor(private readonly cvService: CvService) {}

  @Post('upload')
  async upload(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const userId = (req as any).user.userId;
    const data = await req.file();

    if (!data) {
      return reply.status(400).send({ message: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();
    const mimetype = data.mimetype;
    const filename = data.filename;

    const profile = await this.cvService.processCV(userId, buffer, mimetype, filename);
    return reply.send({ success: true, profile });
  }

  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.cvService.getProfile(req.user.userId);
  }

  @Delete('profile')
  async deleteProfile(@Req() req: any) {
    return this.cvService.deleteProfile(req.user.userId);
  }
}
```

---

## cv.service.ts

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { getDB } from '../database/db';
import { CVProfile } from '../types/cv.types';

@Injectable()
export class CvService {

  async processCV(
    userId: string,
    buffer: Buffer,
    mimetype: string,
    filename: string
  ): Promise<CVProfile> {

    // 1. Extract raw text
    let rawText = '';

    if (mimetype === 'application/pdf') {
      const data = await pdfParse(buffer);
      rawText = data.text;
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else {
      throw new BadRequestException('Only PDF and DOCX files are supported');
    }

    if (!rawText || rawText.trim().length < 100) {
      throw new BadRequestException('CV appears to be empty or unreadable');
    }

    // 2. Parse with DeepSeek V3
    const parsedProfile = await this.parseWithAI(rawText);

    // 3. Store in Neon
    const sql = getDB();
    await sql`
      INSERT INTO cv_profiles (user_id, raw_text, parsed_profile, filename)
      VALUES (${userId}, ${rawText}, ${JSON.stringify(parsedProfile)}, ${filename})
      ON CONFLICT (user_id) DO UPDATE SET
        raw_text = EXCLUDED.raw_text,
        parsed_profile = EXCLUDED.parsed_profile,
        filename = EXCLUDED.filename,
        updated_at = NOW()
    `;

    return parsedProfile;
  }

  private async parseWithAI(rawText: string): Promise<CVProfile> {
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
            content: `You are a CV parser. Extract information from the CV text and return ONLY a valid JSON object. No markdown, no explanation, just raw JSON.

Return this exact structure:
{
  "name": "Full Name",
  "currentRole": "Most recent job title",
  "yearsExperience": 5,
  "skills": ["skill1", "skill2"],
  "companies": [
    {
      "name": "Company Name",
      "role": "Job Title",
      "duration": "Jan 2022 – Present",
      "achievements": ["Achievement 1", "Achievement 2"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "What it does",
      "stack": ["tech1", "tech2"],
      "impact": "What was achieved or metrics"
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "BSc Computer Science",
      "year": "2019"
    }
  ],
  "certifications": ["ACAMS", "AWS Solutions Architect"],
  "summary": "2-3 sentence professional summary"
}`
          },
          {
            role: 'user',
            content: `Parse this CV:\n\n${rawText.slice(0, 8000)}` // cap at 8k chars
          }
        ],
        temperature: 0.1, // low temp for structured extraction
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    try {
      return JSON.parse(content) as CVProfile;
    } catch {
      // Attempt to extract JSON from response if wrapped in text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as CVProfile;
      throw new BadRequestException('Failed to parse CV structure');
    }
  }

  async getProfile(userId: string): Promise<CVProfile> {
    const sql = getDB();
    const [record] = await sql`
      SELECT parsed_profile, filename, updated_at
      FROM cv_profiles
      WHERE user_id = ${userId}
    `;

    if (!record) throw new NotFoundException('No CV uploaded yet');
    return record.parsed_profile as CVProfile;
  }

  async deleteProfile(userId: string): Promise<void> {
    const sql = getDB();
    await sql`DELETE FROM cv_profiles WHERE user_id = ${userId}`;
  }
}
```

---

## Electron CV Upload UI (setup/CVUpload.tsx)

```tsx
'use client';
import { useState, useCallback } from 'react';

interface CVUploadProps {
  onUploaded: (profile: any) => void;
}

export function CVUpload({ onUploaded }: CVUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [filename, setFilename] = useState('');

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext || '')) {
      setError('Only PDF and Word documents are supported');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('access_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cv/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Upload failed');
      }

      const { profile } = await res.json();
      setFilename(file.name);
      onUploaded(profile);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{
        border: '2px dashed rgba(255,255,255,0.2)',
        borderRadius: 12,
        padding: 32,
        textAlign: 'center',
        cursor: 'pointer',
      }}
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.doc,.docx';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) handleFile(file);
        };
        input.click();
      }}
    >
      {uploading ? (
        <p>Parsing your CV...</p>
      ) : filename ? (
        <p>✓ {filename} — CV loaded</p>
      ) : (
        <>
          <p>Drop your CV here or click to upload</p>
          <p style={{ fontSize: 12, opacity: 0.5 }}>PDF or Word document</p>
        </>
      )}
      {error && <p style={{ color: '#ef4444', marginTop: 8 }}>{error}</p>}
    </div>
  );
}
```

---

## Pre-Interview Setup Flow (setup/PreflightCheck.tsx)

```
Step 1: Upload CV (required — blocks Start button)
         ↓
Step 2: Paste Job Description (optional)
         ↓
Step 3: Select Interview Type
         [ Behavioral ] [ Technical ] [ Coding ] [ System Design ]
         ↓
Step 4: Select Answer Length
         [ Brief ] [ Standard ] [ Detailed ]
         ↓
Step 5: Test microphone (quick audio check)
         ↓
         [ Start Interview ]  ← enabled only after CV uploaded
```

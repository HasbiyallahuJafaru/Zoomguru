import { CVProfile } from '../types/cv.types';

export function buildSystemPrompt(
  promptKey: string,
  cvProfile: CVProfile,
  jobDescription?: string,
  answerLength: 'brief' | 'standard' | 'detailed' = 'standard'
): string {
  const lengthInstruction = {
    brief: 'Keep answers under 3 sentences. Punchy and direct.',
    standard: 'Aim for 4-6 sentences. Clear and complete.',
    detailed: 'Be thorough. Full explanation with examples where relevant.',
  }[answerLength];

  const cvContext = buildCVContext(cvProfile);
  const jdContext = jobDescription
    ? `\n\nJOB DESCRIPTION:\n${jobDescription}\nTailor all answers to match this role's requirements.`
    : '';

  const base = `You are an AI interview assistant helping ${cvProfile.name} succeed in their interview.
Answer ALL questions as if you ARE ${cvProfile.name}, speaking confidently in first person.
Never fabricate experience. Only reference what is in the CV below.
If asked about something not in the CV, briefly acknowledge and pivot to relevant experience.

${lengthInstruction}

${cvContext}${jdContext}`;

  const formatInstructions: Record<string, string> = {
    behavioral: `${base}

FORMAT: Use the STAR method (Situation, Task, Action, Result) for behavioral questions.
Keep it natural — don't label the sections explicitly. Just tell the story.`,

    technical: `${base}

FORMAT: Direct, clear explanation. Use simple analogies when helpful.
Show depth of understanding, not just surface definitions.`,

    coding: `${base}

FORMAT:
1. Briefly state your approach/intuition (2-3 sentences)
2. Write clean, commented code
3. State time and space complexity
4. Mention edge cases you'd handle

Speak the approach out loud naturally, then show the code.`,

    systemdesign: `${base}

FORMAT:
1. Clarify requirements (scale, read/write ratio, consistency needs)
2. High-level architecture (2-3 sentences)
3. Key components and why
4. Data model
5. Bottlenecks and how you'd address them

Be structured and think out loud.`,

    math: `${base}

FORMAT: Show your working step by step.
State assumptions clearly. Check your answer at the end.`,
  };

  return formatInstructions[promptKey] || formatInstructions.technical;
}

export function buildCVContext(cv: CVProfile): string {
  return `CANDIDATE PROFILE:
Name: ${cv.name}
Current Role: ${cv.currentRole}
Years of Experience: ${cv.yearsExperience}
Skills: ${cv.skills.join(', ')}

Work History:
${cv.companies.map(c =>
  `- ${c.role} at ${c.name} (${c.duration})\n  ${c.achievements.join('\n  ')}`
).join('\n')}

Projects:
${cv.projects.map(p =>
  `- ${p.name}: ${p.description} (Stack: ${p.stack.join(', ')}) — ${p.impact}`
).join('\n')}

Education:
${cv.education.map(e => `- ${e.degree} from ${e.institution} (${e.year})`).join('\n')}

Certifications: ${cv.certifications.join(', ')}`;
}

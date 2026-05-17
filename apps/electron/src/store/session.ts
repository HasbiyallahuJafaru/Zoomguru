export interface SessionState {
  sessionId: string | null;
  interviewType: 'behavioral' | 'technical' | 'coding' | 'systemdesign';
  answerLength: 'brief' | 'standard' | 'detailed';
  cvProfile: any;
  jobDescription: string;
  startedAt: number | null;
}

export function getSessionId(): string | null {
  return localStorage.getItem('session_id');
}

export function setSessionId(id: string): void {
  localStorage.setItem('session_id', id);
}

export function clearSession(): void {
  localStorage.removeItem('session_id');
}

export function getSessionState(): SessionState {
  return {
    sessionId: localStorage.getItem('session_id'),
    interviewType:
      (localStorage.getItem('interview_type') as SessionState['interviewType']) || 'behavioral',
    answerLength:
      (localStorage.getItem('answer_length') as SessionState['answerLength']) || 'standard',
    cvProfile: (() => {
      try {
        const raw = localStorage.getItem('cv_profile');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })(),
    jobDescription: localStorage.getItem('job_description') || '',
    startedAt: (() => {
      const raw = localStorage.getItem('session_started_at');
      return raw ? parseInt(raw, 10) : null;
    })(),
  };
}

export function saveSessionConfig(config: {
  interviewType: SessionState['interviewType'];
  answerLength: SessionState['answerLength'];
  cvProfile: any;
  jobDescription: string;
}): void {
  localStorage.setItem('interview_type', config.interviewType);
  localStorage.setItem('answer_length', config.answerLength);
  localStorage.setItem('cv_profile', JSON.stringify(config.cvProfile));
  localStorage.setItem('job_description', config.jobDescription);
  localStorage.setItem('session_started_at', Date.now().toString());
}

import { create } from 'zustand';

export type InterviewMode = 'behavioral' | 'technical' | 'coding' | 'systemdesign';
export type AnswerLength = 'brief' | 'standard' | 'detailed';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface SessionState {
  sessionId: string | null;
  mode: InterviewMode;
  answerLength: AnswerLength;
  messages: Message[];
  cvUploaded: boolean;
  jobDescription: string;
  totalQuestions: number;
  sessionStartedAt: string | null;

  setSessionId: (id: string) => void;
  setMode: (mode: InterviewMode) => void;
  setAnswerLength: (length: AnswerLength) => void;
  addMessage: (message: Message) => void;
  setCVUploaded: (val: boolean) => void;
  setJobDescription: (jd: string) => void;
  clearSession: () => void;
  startSession: (sessionId: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  mode: 'behavioral',
  answerLength: 'standard',
  messages: [],
  cvUploaded: false,
  jobDescription: '',
  totalQuestions: 0,
  sessionStartedAt: null,

  setSessionId: (id) => set({ sessionId: id }),
  setMode: (mode) => set({ mode }),
  setAnswerLength: (answerLength) => set({ answerLength }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
      totalQuestions: message.role === 'user'
        ? state.totalQuestions + 1
        : state.totalQuestions,
    })),

  setCVUploaded: (cvUploaded) => set({ cvUploaded }),
  setJobDescription: (jobDescription) => set({ jobDescription }),

  startSession: (sessionId) =>
    set({
      sessionId,
      messages: [],
      totalQuestions: 0,
      sessionStartedAt: new Date().toISOString(),
    }),

  clearSession: () =>
    set({
      sessionId: null,
      messages: [],
      totalQuestions: 0,
      sessionStartedAt: null,
    }),
}));

# PATCH-14 â€” Zustand State Management

## Problem
Auth state, session state, and UI state are scattered across
useState hooks with prop drilling. As overlay grows this breaks.

## Files Affected
- `apps/electron/src/store/auth.store.ts` (new)
- `apps/electron/src/store/session.store.ts` (new)
- `apps/electron/src/store/ui.store.ts` (new)

## Risk Level
ðŸŸ¡ MEDIUM â€” New files only. Existing components not touched yet.
           Migrate components to use store gradually in next sessions.

---

## Claude Code Prompt

```
Read .claude/ELECTRON.md first.

Install Zustand:
cd apps/electron && npm install zustand

Create three new store files. Do not modify any existing
component files in this patch â€” just create the stores.
Components will be migrated to use them in later sessions.

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
FILE 1: apps/electron/src/store/auth.store.ts
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  isPro: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateToken: (accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      updateToken: (accessToken) =>
        set({ accessToken }),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'zg-auth',
      // Only persist tokens and user â€” not derived state
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
FILE 2: apps/electron/src/store/session.store.ts
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
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
  messages: Message[];       // In-memory only â€” NOT persisted to DB mid-session
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

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
FILE 3: apps/electron/src/store/ui.store.ts
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  overlayVisible: boolean;
  isStreaming: boolean;
  isListening: boolean;
  currentAnswer: string;
  opacity: number;
  isOnline: boolean;

  setOverlayVisible: (val: boolean) => void;
  setStreaming: (val: boolean) => void;
  setListening: (val: boolean) => void;
  appendChunk: (chunk: string) => void;
  clearAnswer: () => void;
  setOpacity: (val: number) => void;
  setOnline: (val: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      overlayVisible: true,
      isStreaming: false,
      isListening: false,
      currentAnswer: '',
      opacity: 0.88,
      isOnline: true,

      setOverlayVisible: (overlayVisible) => set({ overlayVisible }),
      setStreaming: (isStreaming) => set({ isStreaming }),
      setListening: (isListening) => set({ isListening }),

      appendChunk: (chunk) =>
        set((state) => ({ currentAnswer: state.currentAnswer + chunk })),

      clearAnswer: () => set({ currentAnswer: '' }),
      setOpacity: (opacity) => set({ opacity }),
      setOnline: (isOnline) => set({ isOnline }),
    }),
    {
      name: 'zg-ui',
      // Only persist user preferences â€” not transient state
      partialize: (state) => ({
        opacity: state.opacity,
      }),
    }
  )
);

Create all three files exactly as specified.
Do not modify any existing component files.
Show me confirmation that all three files were created.
```

---

## After This Patch
Components can now import from stores:
```typescript
import { useAuthStore } from '../store/auth.store';
import { useSessionStore } from '../store/session.store';
import { useUIStore } from '../store/ui.store';

// In any component:
const { user, isAuthenticated } = useAuthStore();
const { mode, setMode } = useSessionStore();
const { opacity, isStreaming } = useUIStore();
```

Migrate components to use stores in subsequent sessions.

## Rollback
Delete all three store files. No existing code was changed.


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
      partialize: (state) => ({
        opacity: state.opacity,
      }),
    }
  )
);

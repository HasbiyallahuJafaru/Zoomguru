// Dev-only config for the screenshot harness (src/shots.tsx).
// The main config boots Electron as a side effect, which is not wanted — and
// not possible — when the goal is a browser to photograph.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
});

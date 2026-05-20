import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig(({ mode }) => {
  // Load env so VITE_* vars are available to the electron sub-compilations too
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    define: {
      // Make VITE_API_URL available as import.meta.env in main + preload
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'import.meta.env.VITE_PAYSTACK_PUBLIC_KEY': JSON.stringify(env.VITE_PAYSTACK_PUBLIC_KEY),
      'import.meta.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV),
    },
    plugins: [
      react(),
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: { outDir: 'dist-electron' },
          },
        },
        {
          entry: 'electron/preload.ts',
          vite: {
            build: { outDir: 'dist-electron' },
          },
          onstart(options) {
            options.reload();
          },
        },
      ]),
      renderer(),
    ],
  };
});

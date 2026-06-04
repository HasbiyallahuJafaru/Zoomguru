import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'dist-renderer',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: 'index.html',
          interviewer: 'interviewer.html',
        },
      },
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify('https://zoomguru.onrender.com'),
      'import.meta.env.VITE_PAYSTACK_PUBLIC_KEY': JSON.stringify('pk_live_5187e2c64d0f6e607ae278857461ee7a0e5c8d55'),
      'import.meta.env.VITE_APP_ENV': JSON.stringify('production'),
    },
    plugins: [
      react(),
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron', 'electron-updater', 'electron-store', 'pdf-parse'],
              },
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
              },
            },
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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'dist-renderer',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: 'index.html',
        },
      },
    },
    plugins: [
      react(),
      electron({
        main: {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron', 'electron-updater', 'electron-store', 'pdf-parse', 'adm-zip', 'xml2js'],
              },
            },
          },
        },
        preload: {
          input: 'electron/preload.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
              },
            },
          },
        },
      }),
    ],
  };
});

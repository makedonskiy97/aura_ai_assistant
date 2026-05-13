import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
            },
          },
        },
      ]),
      renderer(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    }
  };
});

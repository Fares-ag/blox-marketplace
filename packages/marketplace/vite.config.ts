import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  resolve: {
    alias: [
      {
        find: '@drivemarket/shared/styles',
        replacement: path.resolve(__dirname, '../shared/src/styles'),
      },
      {
        find: '@drivemarket/shared/i18n',
        replacement: path.resolve(__dirname, '../shared/src/i18n/index.ts'),
      },
      {
        find: '@drivemarket/shared',
        replacement: path.resolve(__dirname, '../shared/src/index.ts'),
      },
    ],
  },
  css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, '../shared/public'),
  server: { port: 5176, strictPort: true },
  resolve: {
    alias: [
      {
        find: '@drivemarket/shared/styles',
        replacement: path.resolve(__dirname, '../shared/src/styles'),
      },
      {
        find: '@drivemarket/shared',
        replacement: path.resolve(__dirname, '../shared/src/index.ts'),
      },
    ],
  },
  css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
});

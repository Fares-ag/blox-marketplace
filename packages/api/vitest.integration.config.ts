import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
  test: {
    include: ['test/integration/**/*.integration.spec.ts'],
    exclude: ['src/**/*.spec.ts'],
    environment: 'node',
    globalSetup: ['./test/integration/global-setup.ts'],
    globalTeardown: ['./test/integration/global-teardown.ts'],
    setupFiles: ['./test/integration/setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});

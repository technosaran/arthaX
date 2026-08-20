/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './apps/web',
});

const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/apps/web/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@finance-os/shared-types$': '<rootDir>/packages/shared-types/src/index.ts',
    '^@finance-os/db$': '<rootDir>/packages/db/src/index.ts',
    '^@finance-os/logger$': '<rootDir>/packages/logger/src/index.ts',
  },
  testMatch: [
    '<rootDir>/apps/web/src/__tests__/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/apps/*/src/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/packages/*/src/**/*.{test,spec}.{ts,tsx}',
  ],
};

module.exports = createJestConfig(config);

/* eslint-disable @typescript-eslint/no-require-imports */
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@finance-os/shared-types$': '<rootDir>/packages/shared-types/src/index.ts',
    '^@finance-os/db$': '<rootDir>/packages/db/src/index.ts',
    '^@finance-os/logger$': '<rootDir>/packages/logger/src/index.ts',
  },
  testMatch: ['<rootDir>/src/__tests__/**/*.{test,spec}.{ts,tsx}'],
};

module.exports = createJestConfig(config);

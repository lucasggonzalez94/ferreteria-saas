const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/app', '<rootDir>/components', '<rootDir>/lib', '<rootDir>/test', '<rootDir>/types'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'types/**/*.{ts,tsx}',
    '!test/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!lib/api.ts',
    '!lib/hooks/*.ts',
    '!**/*.stories.*',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'json', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 60,
      statements: 60,
    },
  },
  testTimeout: 10000,
  verbose: true,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testPathIgnorePatterns: ['/node_modules/'],
};

module.exports = createJestConfig(customJestConfig);

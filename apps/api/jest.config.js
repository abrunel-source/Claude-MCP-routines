module.exports = {
  displayName: 'api',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/../../libs'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@cadence/shared-types$': '<rootDir>/../../libs/shared-types/src/index.ts',
    '^@cadence/core$': '<rootDir>/../../libs/core/src/index.ts',
    '^@cadence/adapters$': '<rootDir>/../../libs/adapters/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
};

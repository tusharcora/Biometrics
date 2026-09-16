module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^jose$': '<rootDir>/__mocks__/jose.js',
  },
};

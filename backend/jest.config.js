module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^jose$': '<rootDir>/__mocks__/jose.js',
  },
  // Every DB-backed suite shares one Postgres test database (and one Redis).
  // Suites seed and delete rows for real, so running them in parallel workers
  // makes results order-dependent (the sleep resync suite failed
  // intermittently in parallel runs and never in isolation, which is
  // consistent with this; the exact colliding suite was not pinned down).
  // Serial is slower but deterministic.
  maxWorkers: 1,
};

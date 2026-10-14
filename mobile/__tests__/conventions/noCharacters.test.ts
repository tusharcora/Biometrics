import fs from 'fs';
import path from 'path';
import { sourceFiles } from '../../jest-mocks/sourceScan';

// The pixel coach cast is gone (spec 2026-10-14 KIP Coach §1): nothing may import it again.
const ROOT = path.join(__dirname, '../..');
const SCANNED = ['src', '__tests__', 'jest-mocks'].flatMap((d) => sourceFiles(path.join(ROOT, d))).concat(path.join(ROOT, 'App.tsx'));
const CAST = /from\s+['"][^'"]*\/(components\/characters|characters)\/[^'"]*['"]|require\(\s*['"][^'"]*\/(components\/characters|characters)\//;

it('no file imports components/characters or characters/', () => {
  const offenders = SCANNED.filter((f) => f !== __filename && CAST.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  expect(offenders).toEqual([]);
});

it('the cast\'s folders and its sprite generator are gone', () => {
  for (const p of ['src/components/characters', 'src/characters', 'scripts/port-sprites.mjs', 'src/screens/MeetYourCoachScreen.tsx', 'src/screens/ThinkingStyleScreen.tsx']) {
    expect(fs.existsSync(path.join(ROOT, p))).toBe(false);
  }
});

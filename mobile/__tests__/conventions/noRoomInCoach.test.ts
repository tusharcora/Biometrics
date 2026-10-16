import * as fs from 'fs';
import * as path from 'path';
import { sourceFiles } from '../../jest-mocks/sourceScan';

// Spec 2026-10-15 §8.1, §12: nothing cosmetic or effect-related reaches the coach or the model. The app's coach code
// (its API, stream, answers, prompts, status and conversation) never imports the room, coins or cosmetics.
const SRC = path.join(__dirname, '../../src');
const COACH = sourceFiles(SRC).filter((f) => /\/(api\/coach[^/]*|lib\/coach[^/]*|lib\/coachStatus\/[^/]+|lib\/useCoach[^/]*)\.(ts|tsx)$/.test(f.split(path.sep).join('/')));
const IMPORT = /(?:from|require\()\s*['"][^'"]*(?:\/room\/|\/coins\/|\/cosmetics|\/effects)[^'"]*['"]/;

it('finds the coach files it guards', () => {
  expect(COACH.length).toBeGreaterThanOrEqual(6);
});

it('no coach file imports the room, coins, cosmetics or effects', () => {
  expect(COACH.filter((f) => IMPORT.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f))).toEqual([]);
});

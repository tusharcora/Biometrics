import * as fs from 'fs';
import * as path from 'path';
import { sourceFiles } from '../../jest-mocks/sourceScan';

// P4 ruling 21: a visit opens from the buddy's week and the chat thread's header avatar only. Nothing on the Campfire.
const SRC = path.join(__dirname, '../../src');
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/');

it('only the buddy\'s week and the chat thread open BuddyRoom', () => {
  const opens = sourceFiles(SRC).filter((f) => /navigate\(\s*['"]BuddyRoom['"]/.test(fs.readFileSync(f, 'utf8'))).map(rel).sort();
  expect(opens).toEqual(['screens/BuddyWeekScreen.tsx', 'screens/ChatThreadScreen.tsx']);
});

// P4 ruling 22: the challenge opens from the KIP page's room card only; the editor's theme tab opens from the challenge.
it('only the KIP page opens RoomChallenge, and only the challenge opens the editor on its theme tab', () => {
  const files = sourceFiles(SRC);
  const opens = files.filter((f) => /navigate\(\s*['"]RoomChallenge['"]/.test(fs.readFileSync(f, 'utf8'))).map(rel).sort();
  expect(opens).toEqual(['screens/CoachScreen.tsx']);
  const theme = files.filter((f) => /navigate\(\s*'DecorateRoom',\s*{\s*drawer:\s*'theme'/.test(fs.readFileSync(f, 'utf8'))).map(rel).sort();
  expect(theme).toEqual(['screens/RoomChallengeScreen.tsx']);
});

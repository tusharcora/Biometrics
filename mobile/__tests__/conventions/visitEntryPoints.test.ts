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

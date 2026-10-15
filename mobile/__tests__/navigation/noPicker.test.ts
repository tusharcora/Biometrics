import fs from 'fs';
import path from 'path';
import { MODAL_ROUTES } from '../../src/navigation/navigationRef';

it('has no picker or thinking-style route, and RecapStory, decorate mode and the coin history are the only modals (spec §8; KIP room §6; free-build §6.7)', () => {
  expect([...MODAL_ROUTES]).toEqual(['RecapStory', 'DecorateRoom', 'CoinHistory']);
  const nav = fs.readFileSync(path.join(__dirname, '../../src/navigation/RootNavigator.tsx'), 'utf8');
  expect(nav).not.toMatch(/MeetYourCoach|ThinkingStyle\b/);
});

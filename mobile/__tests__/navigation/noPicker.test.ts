import fs from 'fs';
import path from 'path';
import { MODAL_ROUTES } from '../../src/navigation/navigationRef';

it('has no picker or thinking-style route, and RecapStory, decorate mode, the coin history, the coin shop, Room sizes, the piece card, sending a gift, the cheers on your room and the room challenge are the only modals (spec §8; KIP room §6; free-build §6.6, §6.7, §7, §8.1, §10.2, §10.3, §10.4; PF4-F6)', () => {
  expect([...MODAL_ROUTES]).toEqual(['RecapStory', 'DecorateRoom', 'CoinHistory', 'CoinShop', 'RoomSizes', 'PieceCard', 'GiftSend', 'RoomCheers', 'RoomChallenge']);
  const nav = fs.readFileSync(path.join(__dirname, '../../src/navigation/RootNavigator.tsx'), 'utf8');
  expect(nav).not.toMatch(/MeetYourCoach|ThinkingStyle\b/);
});

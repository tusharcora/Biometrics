import fs from 'fs';
import path from 'path';
import { USER_OWNED_MODELS } from '../../src/users/deletion';

// Spec §2 "Never remove owned": nothing deletes an unlock row by name. Account deletion and the fixture purge
// delete through USER_OWNED_MODELS (delegateFor), so the only path is the whole account.
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : /\.ts$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

it('no source deletes a cosmetic unlock', () => {
  const root = path.join(__dirname, '../..');
  const hits = [...files(path.join(root, 'src')), ...files(path.join(root, 'scripts'))]
    .filter((f) => /cosmeticUnlock\s*\.\s*delete(Many)?\s*\(/.test(fs.readFileSync(f, 'utf8')));
  expect(hits).toEqual([]);
});

it('account deletion owns both cosmetics tables', () => {
  expect(USER_OWNED_MODELS).toEqual(expect.arrayContaining(['CosmeticUnlock', 'CosmeticLoadout', 'RoomFirstWeek']));
});

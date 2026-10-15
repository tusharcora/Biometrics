import fs from 'fs';
import path from 'path';
import { USER_OWNED_MODELS } from '../../src/users/deletion';

// Spec §2 "Never remove owned": nothing deletes an unlock row, a coin event or an item grant, by name or by SQL.
// Account deletion and the fixture purge delete through USER_OWNED_MODELS (delegateFor), so the only path is the
// whole account. A coin event is append-only: only the coin history marks one seen.
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : /\.ts$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

it('no source deletes a cosmetic unlock, a coin event or an item grant, by name or by SQL (spec §2.2, §6.3)', () => {
  const root = path.join(__dirname, '../..');
  const allowed = new Set([path.join(root, 'src/users/deletion.ts'), path.join(root, 'scripts/purgeTestFixtures.ts')]);
  const DELETE = /(cosmeticUnlock|coinEvent|itemGrant)\s*\.\s*delete(Many)?\s*\(|DELETE\s+FROM\s+"?(CosmeticUnlock|CoinEvent|ItemGrant)\b/i;
  const hits = [...files(path.join(root, 'src')), ...files(path.join(root, 'scripts'))]
    .filter((f) => !allowed.has(f) && DELETE.test(fs.readFileSync(f, 'utf8')));
  expect(hits).toEqual([]);
});

it('only the coin history updates a coin event (to mark it seen), by name or by SQL', () => {
  const root = path.join(__dirname, '../..');
  const UPDATE = /coinEvent\s*\.\s*update(Many)?\s*\(|UPDATE\s+"?CoinEvent\b/i;
  const hits = [...files(path.join(root, 'src')), ...files(path.join(root, 'scripts'))].filter((f) => UPDATE.test(fs.readFileSync(f, 'utf8')));
  expect(hits.map((f) => path.relative(root, f)).filter((f) => f !== 'src/coins/history.ts')).toEqual([]);
});

it('account deletion owns every room and coin table', () => {
  expect(USER_OWNED_MODELS).toEqual(expect.arrayContaining(['CosmeticUnlock', 'CosmeticLoadout', 'RoomFirstWeek', 'CoinEvent', 'CoinWallet', 'ItemGrant']));
});

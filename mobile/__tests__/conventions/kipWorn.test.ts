import fs from 'fs';
import path from 'path';
import { sourceFiles } from '../../jest-mocks/sourceScan';

// Spec 2026-10-14 KIP's room §7: every <Kip> and <PersonKip> passes what that KIP wears. The only exceptions draw a
// KIP that is nobody's (signed-out screens, the dev gallery) or a colour preview.
const SRC = path.join(__dirname, '../../src');
const EXEMPT: Record<string, string> = {
  'screens/SignUpScreen.tsx': 'signed out: a coral KIP that is nobody yet',
  'screens/ForgotPasswordScreen.tsx': 'signed out',
  'screens/ResetPasswordScreen.tsx': 'signed out',
  'components/onboarding-hero.tsx': 'the onboarding mascot before any account data loads',
  'screens/dev/KipGalleryScreen.tsx': 'the dev gallery draws every pose and mood bare',
  'components/kip/Kip.tsx': 'the component itself',
  'components/kip/PersonKip.tsx': 'the component itself',
  'components/social/CampScene.tsx': 'frozen (OVERRIDE-P13): the Campfire draws KIPs bare until the owner unfreezes it',
  'components/social/CampBanner.tsx': 'frozen (OVERRIDE-P13): the Campfire draws KIPs bare until the owner unfreezes it',
};

it('every Kip and PersonKip outside the exemptions passes worn', () => {
  const hits = sourceFiles(SRC).flatMap((file) => {
    const rel = path.relative(SRC, file);
    if (EXEMPT[rel]) return [];
    const text = fs.readFileSync(file, 'utf8');
    const tags = text.match(/<(Kip|PersonKip)\b[^>]*>/gs) ?? [];
    return tags.filter((t) => !/\bworn=/.test(t)).map((t) => `${rel}: ${t.slice(0, 60)}`);
  });
  expect(hits).toEqual([]);
});

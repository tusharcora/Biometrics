import fs from 'fs';
import path from 'path';
import { openingTag, sourceFiles } from '../../jest-mocks/sourceScan';

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

// Each tag and the prop that must carry what that KIP wears. Wrappers pass it on to Kip / PersonKip, so an
// optional prop there could silently drop an outfit (Spec B Task 12 minor). `worn={undefined}` is no outfit.
const WORN_PROP: Record<string, string> = {
  Kip: 'worn', PersonKip: 'worn', ProfileButton: 'worn', HomeHeader: 'myWorn', HomeScene: 'myWorn',
  RecapCardView: 'kipWorn', YearPixelsView: 'kipWorn', WeeklyStoryView: 'kipWorn', CampNoteCard: 'kipWorn',
};
const TAG = new RegExp(`<(${Object.keys(WORN_PROP).join('|')})\\b`, 'g');

it('every Kip, PersonKip and worn-passing wrapper outside the exemptions passes what KIP wears', () => {
  const hits = sourceFiles(SRC).flatMap((file) => {
    const rel = path.relative(SRC, file);
    if (EXEMPT[rel]) return [];
    const text = fs.readFileSync(file, 'utf8');
    const out: string[] = [];
    for (const m of text.matchAll(TAG)) {
      const prop = WORN_PROP[m[1]!]!;
      if (!new RegExp(`\\b${prop}=\\{(?!\\s*undefined\\s*\\})`).test(openingTag(text, m.index!))) out.push(`${rel}: <${m[1]}> without ${prop}`);
    }
    return out;
  });
  expect(hits).toEqual([]);
});

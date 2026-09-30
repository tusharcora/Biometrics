import { DEFAULT_CHARACTER_ID, isCharacterId, type CharacterId } from './types';

export interface CharacterInfo {
  id: CharacterId;
  name: string;
  /** Glow and picker accent, taken from the character's mockup. */
  accent: string;
  /** Local copy for the picker; the server's persona copy wins when present (spec §1 Registry). */
  tagline: string;
  greeting: string;
}

// Pure data: no Skia import, so screens and tests can use it freely.
export const CHARACTERS: Record<CharacterId, CharacterInfo> = {
  hoot: {
    id: 'hoot',
    name: 'Hoot',
    accent: '#6366F1',
    tagline: 'Calm and curious. Spots the patterns in your weeks.',
    greeting: "I've been watching your numbers overnight. Want to see what stood out?",
  },
  pip: {
    id: 'pip',
    name: 'Pip',
    accent: '#2DD4BF',
    tagline: 'Your tiny cheerleader. Celebrates every small win.',
    greeting: "Hi! You showed up, and that's already a win. What should we look at?",
  },
  mochi: {
    id: 'mochi',
    name: 'Mochi',
    accent: '#F9A8D4',
    tagline: 'Soft and gentle. Rest is never something to feel bad about.',
    greeting: 'Hey you. No pressure today. How are you feeling?',
  },
  nimbus: {
    id: 'nimbus',
    name: 'Nimbus',
    accent: '#7DD3FC',
    tagline: 'Reads your body like a forecast and plans your day around it.',
    greeting: "Today's forecast: mostly clear, good day to push a little. Want the details?",
  },
  ember: {
    id: 'ember',
    name: 'Ember',
    accent: '#FB923C',
    tagline: 'All energy. Helps you train smart and push when it counts.',
    greeting: "Your body's got fuel today. Want to put it to work?",
  },
  beep: {
    id: 'beep',
    name: 'Beep',
    accent: '#5EEAD4',
    tagline: 'Just the numbers, clearly. No fluff.',
    greeting: 'Data synced. Three metrics moved since yesterday. Want the list?',
  },
  doze: {
    id: 'doze',
    name: 'Doze',
    accent: '#C4B5FD',
    tagline: 'Your sleep expert. Cosy, slow and all about good nights.',
    greeting: '*yawn* Oh, hi. Shall we talk about how you slept?',
  },
  beat: {
    id: 'beat',
    name: 'Beat',
    accent: '#FB7185',
    tagline: 'Listens to your heart, literally.',
    greeting: "Your heart's been busy. Want to hear how it's doing?",
  },
};

/** Any id the app doesn't know (old build, bad cache, null) is Hoot. */
export function characterInfo(id: string | null | undefined): CharacterInfo {
  return CHARACTERS[isCharacterId(id) ? id : DEFAULT_CHARACTER_ID];
}

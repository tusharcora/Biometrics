import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { CoachCard } from '../../src/components/characters/CoachCard';
import { CHARACTERS } from '../../src/components/characters/registry';
import type { CharacterId } from '../../src/components/characters/types';
import { characterLabel } from '../../jest-mocks/characterContext';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockScheme, setColorScheme: jest.fn(), toggleColorScheme: jest.fn() }),
}));

afterEach(() => {
  mockScheme = 'light';
});

// WCAG 2 relative luminance and contrast ratio, computed independently of the component.
const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) => {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
// The chip's 16 % accent wash composited on the white light-mode card.
const chipOnWhite = (accent: string) =>
  '#' + channels(accent).map((v) => Math.round(255 * 0.84 + v * 0.16).toString(16).padStart(2, '0')).join('');
const focusColor = (s: ReturnType<typeof render>) =>
  (StyleSheet.flatten(s.getByTestId('coach-card-focus').props.style) as { color: string }).color;
const IDS = Object.keys(CHARACTERS) as CharacterId[];

it('shows number, focus, name, tagline and greeting, with the coach idle at 120', () => {
  const s = render(<CoachCard characterId="kit" testID="card" />);
  expect(s.getByText('No.07')).toBeTruthy();
  expect(s.getByText('Bedtime')).toBeTruthy();
  expect(s.getByText('Kit')).toBeTruthy();
  expect(s.getByText('Dry wit. Gently judges your bedtime.')).toBeTruthy();
  expect(characterLabel(s, 'card')).toBe('character:kit:idle:120:playing:none');
});

it('prefers server copy when given', () => {
  const s = render(<CoachCard characterId="kit" tagline="Server tagline" greeting="Server hi" />);
  expect(s.getByText('Server tagline')).toBeTruthy();
  expect(s.getByText('Server hi')).toBeTruthy();
});

it('pads single-digit numbers and passes paused through to the sprite', () => {
  const s = render(<CoachCard characterId="mochi" paused testID="card" />);
  expect(s.getByText('No.01')).toBeTruthy();
  expect(characterLabel(s, 'card')).toBe('character:mochi:idle:120:paused:none');
});

it('announces the coach name as a header', () => {
  const s = render(<CoachCard characterId="kit" />);
  expect(s.getByRole('header', { name: 'Kit' })).toBeTruthy();
});

it('has 15 coaches to check', () => {
  expect(IDS).toHaveLength(15);
});

it.each(IDS)('light mode: %s focus chip text reads at 4.5:1 or better', (id) => {
  mockScheme = 'light';
  const s = render(<CoachCard characterId={id} />);
  const accent = CHARACTERS[id].accent;
  expect(contrast(focusColor(s), chipOnWhite(accent))).toBeGreaterThanOrEqual(4.5);
});

it.each(IDS)('dark mode: %s focus chip text keeps the accent', (id) => {
  mockScheme = 'dark';
  const s = render(<CoachCard characterId={id} />);
  expect(focusColor(s)).toBe(CHARACTERS[id].accent);
});

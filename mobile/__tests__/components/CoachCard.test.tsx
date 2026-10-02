import { render } from '@testing-library/react-native';
import { CoachCard } from '../../src/components/characters/CoachCard';
import { characterLabel } from '../../jest-mocks/characterContext';

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

// Test helpers for screens that draw a KIP. Kept out of __tests__ (jest would collect it).
import { within, type render } from '@testing-library/react-native';
import { Rect } from 'react-native-svg';
import { kipArt, type KipVariant } from '../src/lib/kip/kipArt';
import { HIDDEN_OK } from './coachStatus';

/** The fills of the KIP drawn inside the element with this testID (KIP is decorative, so hidden). */
export function kipFills(screen: Pick<ReturnType<typeof render>, 'getByTestId'>, testID: string): string[] {
  return within(screen.getByTestId(testID, HIDDEN_OK)).UNSAFE_getAllByType(Rect).map((r) => r.props.fill as string);
}

/** The fills a KIP of this colour, pose and mood draws: compare with kipFills. */
export function kipArtFills(variant: KipVariant): string[] {
  return kipArt(variant).map((r) => r.fill);
}

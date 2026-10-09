import { FONTS } from '../theme';

// Native stack and tab headers sit outside NativeWind, so their title takes a
// real style: Silkscreen at 15 (spec §3). Each screen's title is written in
// caps where it is set, so a pushed screen's header (BADGES, FORECAST) matches
// the in-page PageTitle.
export const HEADER_TITLE_SIZE = 15;

export function headerTitleStyle(color: string): { color: string; fontFamily: string; fontSize: number } {
  return { color, fontFamily: FONTS.pixel, fontSize: HEADER_TITLE_SIZE };
}

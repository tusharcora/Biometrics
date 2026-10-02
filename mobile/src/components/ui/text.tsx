import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { cn } from '../../lib/utils';
import { FONTS } from '../../theme';

// React Native selects a custom face by family name, so a `font-bold` class
// alone would keep drawing Geist Regular (or a synthesized bold). Resolve the
// weight class to that weight's own family instead; `font-display` opts into
// the serif. Checked strongest-first so "font-bold" wins over a stray
// "font-medium" merged in from a caller.
const WEIGHT_FAMILIES: Array<[RegExp, string]> = [
  [/(^|\s)font-(extrabold|black)(\s|$)/, FONTS.sansExtrabold],
  [/(^|\s)font-bold(\s|$)/, FONTS.sansBold],
  [/(^|\s)font-semibold(\s|$)/, FONTS.sansSemibold],
  [/(^|\s)font-medium(\s|$)/, FONTS.sansMedium],
];

export function fontFamilyFor(className?: string): string {
  if (!className) return FONTS.sans;
  if (/(^|\s)font-display(\s|$)/.test(className)) return FONTS.display;
  for (const [pattern, family] of WEIGHT_FAMILIES) {
    if (pattern.test(className)) return family;
  }
  return FONTS.sans;
}

// React 19 passes `ref` as a prop, so it reaches the native text through the spread.
export function Text({ className, style, ...props }: TextProps & { className?: string; ref?: React.Ref<RNText> }) {
  return <RNText className={cn('text-foreground', className)} style={[{ fontFamily: fontFamilyFor(className) }, style]} {...props} />;
}

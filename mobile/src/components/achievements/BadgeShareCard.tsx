import React from 'react';
import { View } from 'react-native';
import type { AchievementFamily } from '../../api/achievements';
import { badgeGround, tierColors, tierInk } from '../../lib/badgeArt';
import { levelTitle, valueLine } from '../../lib/badges';
import type { KipColour } from '../../lib/kip/kipArt';
import { APP_NAME, EXPORT_PIXELS } from '../../lib/recapShare';
import { FONTS } from '../../theme';
import { pixelFont } from '../coach/thinking/shared';
import { Text } from '../ui/text';
import { BadgeIcon } from './BadgeIcon';

// The celebration's share image (spec 2026-10-06 §6): a square 360-unit design × scale, captured
// at 1080 px through the recap export pipeline. The app name only, never a name or email.
export const BADGE_SHARE_SIZE = 360;

/** Laid out 1080 / pixelRatio points wide, so the capture is 1080×1080 px on any device. */
export function badgeShareLayout(pixelRatio: number): { width: number; height: number; scale: number } {
  const width = EXPORT_PIXELS / pixelRatio;
  return { width, height: width, scale: width / BADGE_SHARE_SIZE };
}

export interface BadgeShareCardProps { family: AchievementFamily; level: number; value: number; colour: KipColour; scale: number }

export function BadgeShareCard({ family, level, value, colour, scale }: BadgeShareCardProps) {
  const u = (n: number) => n * scale;
  const ground = badgeGround(tierColors(level, colour).ring);
  // Text and pips in a colour that reads on the ground (level V's dark KIPs are lifted); the badge keeps its ring.
  const ink = tierInk(level, colour, ground);
  const pixel = pixelFont();
  return (
    <View
      testID="badge-share-card"
      style={{ width: u(BADGE_SHARE_SIZE), height: u(BADGE_SHARE_SIZE), backgroundColor: ground, alignItems: 'center', justifyContent: 'center', gap: u(14), padding: u(24) }}
    >
      <BadgeIcon family={family} level={level} size={u(150)} colour={colour} pipSurface={ground} testID="badge-share-icon" />
      <Text style={{ fontFamily: pixel, fontSize: u(20), lineHeight: u(24), color: '#FAFAF9', textAlign: 'center' }}>{levelTitle(family, level).toUpperCase()}</Text>
      <Text testID="badge-share-value" style={{ fontFamily: FONTS.sans, fontSize: u(14), lineHeight: u(20), color: ink.glyph, textAlign: 'center' }}>{valueLine(family, value)}</Text>
      <Text testID="badge-share-app" style={{ fontFamily: pixel, fontSize: u(12), lineHeight: u(16), color: ink.ring }}>{APP_NAME}</Text>
    </View>
  );
}

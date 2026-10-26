import { recapTint, storyRingColor } from '../../src/lib/recapTheme';
import { badgeGround, kipTier, TIER_SURFACE, tierColors, tierInk, tierTextColor } from '../../src/lib/badgeArt';
import { TIER_NAMES, tierName } from '../../src/lib/badges';
import { contrast, mixHex } from '../../src/lib/colour';
import { KIP_COLOURS, kipRamp, type KipColour } from '../../src/lib/kip/kipArt';

const ALL = Object.keys(KIP_COLOURS) as KipColour[];

describe('recaps take your KIP colour (spec §7.7)', () => {
  it.each(ALL)('%s: a tint whose text reads on its ground', (colour) => {
    const t = recapTint(colour);
    expect(t.accent).toBe(KIP_COLOURS[colour]);
    expect(contrast(t.accentText, t.ground)).toBeGreaterThanOrEqual(4.6);
    expect(contrast(t.text, t.ground)).toBeGreaterThanOrEqual(4.6);
  });

  it.each(ALL)('%s: a story ring that stands out on both themes', (colour) => {
    for (const scheme of ['light', 'dark'] as const) {
      const ring = storyRingColor(colour, scheme);
      for (const surface of scheme === 'dark' ? ['#0A0B0E', '#14161B'] : ['#F6F6F7', '#FFFFFF']) expect(contrast(ring, surface)).toBeGreaterThanOrEqual(3.1);
    }
  });
});

describe('level V badges use the KIP ramp', () => {
  it.each(ALL)('%s: ring = body, fill = deep toward black, glyph = light', (colour) => {
    const ramp = kipRamp(KIP_COLOURS[colour]);
    // badgeArt's mixHex upper-cases its output; lib/colour's does not.
    expect(kipTier(colour)).toEqual({ ring: ramp.body, fill: mixHex(ramp.deep, '#000000', 0.5).toUpperCase(), glyph: ramp.light });
    expect(tierColors(5, colour)).toEqual(kipTier(colour));
    expect(tierColors(3, colour)).toEqual(tierColors(3, 'coral'));
  });

  it('keeps small level-V text readable on the light page', () => {
    for (const colour of ALL) expect(contrast(tierTextColor(5, colour, false), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps small level-V text readable on the dark page and card too (ink, slate are lifted)', () => {
    for (const colour of ALL) {
      for (const surface of ['#0A0B0E', '#14161B']) expect(contrast(tierTextColor(5, colour, true), surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(ALL)("%s: level-V text, pips and the Nice! fill read at 4.5:1 on the badge's dark ground; the ring art stays raw", (colour) => {
    const t = tierColors(5, colour);
    const ground = badgeGround(t.ring);
    const ink = tierInk(5, colour, ground);
    expect(contrast(ink.ring, ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink.glyph, ground)).toBeGreaterThanOrEqual(4.5);
    expect(t.ring).toBe(KIP_COLOURS[colour]);
  });

  it.each(ALL)('%s: level-V pips and progress read at 4.5:1 on the app surfaces in both themes', (colour) => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(contrast(tierInk(5, colour, TIER_SURFACE[scheme]).ring, TIER_SURFACE[scheme])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('leaves levels 0 to IV exactly the canvas colours on any surface', () => {
    for (const level of [0, 1, 2, 3, 4]) {
      const { ring, glyph } = tierColors(level, 'ink');
      expect(tierInk(level, 'ink', '#0B0B0F')).toEqual({ ring, glyph });
    }
    // A colour that already reads is kept as it is.
    expect(tierInk(5, 'lemon', badgeGround(KIP_COLOURS.lemon)).ring).toBe(KIP_COLOURS.lemon);
  });

  it('calls level V "Legend" in copy; the level number is unchanged', () => {
    expect(TIER_NAMES).toEqual(['Bronze', 'Silver', 'Gold', 'Diamond', 'Legend']);
    expect(tierName(5)).toBe('Legend');
  });
});

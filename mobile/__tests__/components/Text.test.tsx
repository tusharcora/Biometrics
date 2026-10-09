import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { Text, fontFamilyFor, textStyleFor } from '../../src/components/ui/text';
import { SectionLabel } from '../../src/components/ui/section-label';
import { FONTS } from '../../src/theme';

const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;
const classes = (el: { props: { className?: unknown } }) => String(el.props.className).split(' ');

describe('fontFamilyFor', () => {
  it('draws the pixel tokens and font-pixel in Silkscreen, whatever weight class sits beside them', () => {
    expect(fontFamilyFor('text-page-title')).toBe(FONTS.pixel);
    expect(fontFamilyFor('text-label uppercase text-muted-foreground')).toBe(FONTS.pixel);
    expect(fontFamilyFor('font-pixel text-[28px]')).toBe(FONTS.pixel);
    expect(fontFamilyFor('text-label font-semibold')).toBe(FONTS.pixel);
  });

  it('gives each Geist token its own weight', () => {
    expect(fontFamilyFor('text-score')).toBe(FONTS.sansSemibold);
    expect(fontFamilyFor('text-number')).toBe(FONTS.sansSemibold);
    expect(fontFamilyFor('text-display')).toBe(FONTS.sansBold);
    expect(fontFamilyFor('text-heading')).toBe(FONTS.sansSemibold);
    expect(fontFamilyFor('text-headline')).toBe(FONTS.sansSemibold);
    expect(fontFamilyFor('text-body')).toBe(FONTS.sans);
    expect(fontFamilyFor('text-caption text-muted-foreground')).toBe(FONTS.sans);
    expect(fontFamilyFor('text-fine')).toBe(FONTS.sansMedium);
  });

  it('lets a weight class beat the token weight', () => {
    expect(fontFamilyFor('text-body font-semibold')).toBe(FONTS.sansSemibold);
    expect(fontFamilyFor('text-heading font-bold')).toBe(FONTS.sansBold);
    expect(fontFamilyFor('text-display font-medium')).toBe(FONTS.sansMedium);
  });

  it('does not read a colour that starts with a token name as that token', () => {
    expect(fontFamilyFor('text-score-excellent')).toBe(FONTS.sans);
  });

  it('keeps the plain, weight and serif behaviour', () => {
    expect(fontFamilyFor(undefined)).toBe(FONTS.sans);
    expect(fontFamilyFor('font-bold font-medium')).toBe(FONTS.sansBold);
    expect(fontFamilyFor('font-display text-display-lg')).toBe(FONTS.display);
  });
});

describe('textStyleFor', () => {
  it('draws the number tokens with tabular figures', () => {
    expect(textStyleFor('text-score')).toEqual({ fontFamily: FONTS.sansSemibold, fontVariant: ['tabular-nums'] });
    expect(textStyleFor('text-number text-metric-steps')).toEqual({ fontFamily: FONTS.sansSemibold, fontVariant: ['tabular-nums'] });
  });

  it('makes any other text tabular with the tabular-nums class, and nothing else', () => {
    expect(textStyleFor('text-display tabular-nums')).toEqual({ fontFamily: FONTS.sansBold, fontVariant: ['tabular-nums'] });
    expect(textStyleFor('text-caption tabular-nums')).toEqual({ fontFamily: FONTS.sans, fontVariant: ['tabular-nums'] });
    expect(textStyleFor('text-heading')).toEqual({ fontFamily: FONTS.sansSemibold });
    expect(textStyleFor('text-score-good')).toEqual({ fontFamily: FONTS.sans });
    expect(textStyleFor(undefined)).toEqual({ fontFamily: FONTS.sans });
  });
});

describe('Text', () => {
  it('puts the face and the figures on the native text, under a caller style', () => {
    const { getByText } = render(
      <Text className="text-number" style={{ color: 'red' }}>
        42
      </Text>,
    );
    expect(flat(getByText('42'))).toEqual(expect.objectContaining({ fontFamily: FONTS.sansSemibold, fontVariant: ['tabular-nums'], color: 'red' }));
  });
});

describe('SectionLabel', () => {
  it('is the pixel label: text-label, uppercase, muted, with the caller classes', () => {
    const { getByText } = render(<SectionLabel className="flex-1">Your metrics</SectionLabel>);
    const label = getByText('Your metrics');
    expect(classes(label)).toEqual(expect.arrayContaining(['text-label', 'uppercase', 'text-muted-foreground', 'flex-1']));
    expect(classes(label)).not.toContain('font-semibold');
    expect(flat(label).fontFamily).toBe(FONTS.pixel);
  });

  it('keeps scaling with the system text size', () => {
    const label = render(<SectionLabel>Today</SectionLabel>).getByText('Today');
    expect(label.props.allowFontScaling).not.toBe(false);
    expect(label.props.maxFontSizeMultiplier).toBeUndefined();
  });
});

import fs from 'fs';
import path from 'path';
import { HEADER_TITLE_SIZE, headerTitleStyle } from '../../src/navigation/headerStyle';
import { FONTS } from '../../src/theme';

const read = (file: string) => fs.readFileSync(path.join(__dirname, '../../src/navigation', file), 'utf8');

it('sets native header titles in Silkscreen at 15', () => {
  expect(HEADER_TITLE_SIZE).toBe(15);
  expect(headerTitleStyle('rgb(1, 2, 3)')).toEqual({ color: 'rgb(1, 2, 3)', fontFamily: FONTS.pixel, fontSize: 15 });
});

it('writes every stack screen title in caps, so a pushed header matches the pixel page titles', () => {
  const src = read('RootNavigator.tsx');
  const titles = [...src.matchAll(/title:\s*'([^']*)'/g)].map((m) => m[1]);
  expect(titles.length).toBeGreaterThan(20);
  for (const title of titles) expect(title).toBe(title.toUpperCase());
  expect(src).toContain('title: FORECAST_COPY.title.toUpperCase()');
  expect(src).toContain('headerTitleStyle: headerTitleStyle(colors.foreground)');
});

it('gives the tab header the same title style, without the stray weight', () => {
  const src = read('TabsNavigator.tsx');
  expect(src).not.toMatch(/fontWeight/);
  expect(src).toContain('headerTitleStyle: headerTitleStyle(colors.foreground)');
});

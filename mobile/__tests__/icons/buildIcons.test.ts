import fs from 'fs';
import path from 'path';
import { ICON_FILES, blockGrid, faceGrid, monochromeGrid, rasterize, spriteGrid, tintedGrid } from '../../src/lib/kip/iconArt';
import { KIP_COLOURS, kipRamp } from '../../src/lib/kip/kipArt';

const MOBILE = path.join(__dirname, '../..');
const app = JSON.parse(fs.readFileSync(path.join(MOBILE, 'app.json'), 'utf8')).expo;

/** Width and height from a PNG's IHDR chunk (bytes 16–23, big-endian). */
function pngSize(file: string): [number, number] {
  const b = fs.readFileSync(path.join(MOBILE, file));
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const pixel = (px: Uint8Array, size: number, x: number, y: number) => Array.from(px.subarray((y * size + x) * 4, (y * size + x) * 4 + 4));
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

describe('the icon art is KIP\'s engine', () => {
  const coral = kipRamp(KIP_COLOURS.coral);

  it('A is the coral block full bleed: body, shade on the right, two eyes, opaque', () => {
    const px = rasterize(faceGrid(), 1024);
    expect(pixel(px, 1024, 0, 0)).toEqual(hex(coral.body));
    expect(pixel(px, 1024, 1023, 0)).toEqual(hex(coral.shade));
    expect(pixel(px, 1024, 320, 440)).toEqual(hex(coral.eyes));
    for (let i = 3; i < px.length; i += 4) if (px[i] !== 255) throw new Error('icon.png must be opaque');
  });

  it('J (dark) sits on #0A0B0E; tinted is greyscale on transparent; monochrome cuts the eyes out', () => {
    expect(pixel(rasterize(blockGrid(), 1024), 1024, 0, 0)).toEqual(hex('#0A0B0E'));
    const tinted = rasterize(tintedGrid(), 1024);
    expect(pixel(tinted, 1024, 0, 0)[3]).toBe(0);
    for (const row of tintedGrid()) for (const c of row) if (c) expect(c.slice(1, 3)).toBe(c.slice(3, 5));
    const mono = monochromeGrid();
    expect([mono[11]![11], mono[15]![15], mono[0]![0]]).toEqual(['#FFFFFF', null, null]);
  });

  it('the splash is the engine sprite at 8 px a cell, centred on transparent', () => {
    const px = rasterize(spriteGrid(), 1024, 8);
    expect(pixel(px, 1024, 0, 0)[3]).toBe(0);
    // Body row 6, column 5 of the sprite → pixel (448 + 40, 448 + 48).
    expect(pixel(px, 1024, 488, 496)).toEqual(hex(coral.body));
  });
});

describe('the files app.json names', () => {
  it.each(ICON_FILES.map((f) => [f.file, f.size] as const))('%s exists at %i × %i', (file, size) => {
    expect(pngSize(file)).toEqual([size, size]);
  });

  it('app.json points at every icon, the iOS light/dark/tinted set and the splash plugin', () => {
    const named = [
      app.icon, app.ios.icon.light, app.ios.icon.dark, app.ios.icon.tinted,
      app.android.adaptiveIcon.foregroundImage, app.android.adaptiveIcon.backgroundImage, app.android.adaptiveIcon.monochromeImage,
      app.web.favicon,
    ];
    const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen');
    expect(splash?.[1]).toEqual({ image: './assets/splash-icon.png', imageWidth: 128, resizeMode: 'contain', backgroundColor: '#0A0B0E' });
    for (const f of [...named, splash[1].image]) {
      expect(fs.existsSync(path.join(MOBILE, f))).toBe(true);
      expect(ICON_FILES.map((i) => `./${i.file}`)).toContain(f);
    }
  });
});

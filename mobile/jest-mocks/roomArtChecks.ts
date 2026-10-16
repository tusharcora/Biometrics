import { KIP_COLOURS, kipRamp } from '../src/lib/kip/kipArt';
import { catalogueItem, catalogueItemsFor, type RoomSlot } from '../src/lib/room/catalogue';
import { itemIcon } from '../src/lib/room/icons';
import { itemArt, type ItemContext } from '../src/lib/room/items';
import '../src/lib/room/art';

export const CTX_DAY: ItemContext = { weather: 'clear', night: false, colour: 'coral', ramp: kipRamp(KIP_COLOURS.coral), screen: 'lines' };
export const CTX_NIGHT: ItemContext = { ...CTX_DAY, weather: 'fallback', night: true };
const LIME: ItemContext = { ...CTX_DAY, colour: 'lime', ramp: kipRamp(KIP_COLOURS.lime) };

/** Pieces the iso room draws itself, with no front-on art (release 3's plank and lantern are skipped by release). */
const ISO_ONLY: ReadonlySet<string> = new Set(['shelf.awards']);

/** Spec §8 / §11 "Item art", for every shipped item of one room slot (set pieces only once their art exists, Task 11). */
export function checkSlotArt(slot: RoomSlot, { sets = true }: { sets?: boolean } = {}): void {
  for (const item of catalogueItemsFor(slot).filter((i) => (sets || !i.id.startsWith('set.')) && i.release !== 3 && !ISO_ONLY.has(i.id))) {
    const art = itemArt(item.id);
    const tag = { id: item.id };
    expect({ ...tag, art: !!art, icon: (itemIcon(item.id)?.length ?? 0) > 0 }).toEqual({ ...tag, art: true, icon: true });
    if (!art) continue;
    expect({ ...tag, slot: art.slot }).toEqual({ ...tag, slot });
    // The flags match the catalogue.
    expect({ ...tag, tint: !!art.tint, emissive: !!art.emissive, frames: art.frames ?? null, style: art.style ?? null })
      .toEqual({ ...tag, tint: !!item.tint, emissive: !!item.emissive, frames: item.frames ?? null, style: item.style ?? null });
    for (const ctx of [CTX_DAY, CTX_NIGHT]) {
      const layers = art.draw(ctx);
      expect({ ...tag, base: (layers.base?.length ?? 0) > 0 }).toEqual({ ...tag, base: true });
      // Front-on art is a sprite source now; Task 7's iso tests check placement (spec 2026-10-15 §3).
      // Emissive items light only in the glow layer; others have none.
      expect({ ...tag, glow: (layers.emissive?.length ?? 0) > 0 }).toEqual({ ...tag, glow: !!item.emissive });
      // Loops have exactly three frames, and they differ.
      if (item.frames) {
        expect({ ...tag, frames: layers.frames?.length }).toEqual({ ...tag, frames: 3 });
        expect({ ...tag, moves: JSON.stringify(layers.frames![0]) !== JSON.stringify(layers.frames![1]) || JSON.stringify(layers.frames![1]) !== JSON.stringify(layers.frames![2]) || ctx.night })
          .toEqual({ ...tag, moves: true });
      } else {
        expect({ ...tag, frames: layers.frames ?? null }).toEqual({ ...tag, frames: null });
      }
      // Deterministic.
      expect(art.draw(ctx)).toEqual(layers);
    }
    // Tinted items follow KIP's colour; others never do. A looping desk's screen takes KIP's colour as the accent of
    // its dots (Spec A), though it is not tinted; its idle lines do not.
    const follows = (screen: ItemContext['screen']) =>
      JSON.stringify(art.draw({ ...CTX_DAY, screen })) !== JSON.stringify(art.draw({ ...LIME, screen }));
    if (slot === 'desk' && item.frames) {
      expect({ ...tag, dots: follows('dots'), lines: follows('lines') }).toEqual({ ...tag, dots: true, lines: !!item.tint });
    } else {
      expect({ ...tag, follows: follows('lines') }).toEqual({ ...tag, follows: !!item.tint });
    }
  }
  expect(catalogueItem('no.such')).toBeUndefined();
}

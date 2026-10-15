// Registers every room piece's art and icon (spec 2026-10-14 KIP's room §8). draw.ts imports this once.
import './starterItems';
import './items/wallpaper';
import './items/floor';
import './items/art';
import './items/window';
import './items/shelf';
import './items/desk';
import './items/deskItem';
import './items/plant';
import './items/lamp';
import './items/corner';
import './items/rug';
import './items/pet';
import './items/shop';
import { COTTAGE_SWATCHES } from './items/sets/cottage';
import type { SetId } from './catalogue';

/** Each set's four palette swatches for its Sets card (ruling 20). */
export const SET_SWATCHES: Readonly<Record<SetId, readonly string[]>> = { cottage: COTTAGE_SWATCHES };

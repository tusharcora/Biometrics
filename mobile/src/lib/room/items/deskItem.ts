// Desk items (CatDesk.dc.html "ITEMS"): each board sprite stands on the desk top (y 72) in the 8-cell anchor between
// the monitor and KIP (x 102-110), on a soft shadow. The pill organiser and the controller are wider than the
// anchor, so the room draws them narrower in the same colours; their icons keep the board's full sprites.
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { standingPiece } from './shared';

const DESK_TOP = 72;

// The board sprites, verbatim (CatDesk.dc.html:98-108).
const MUG: readonly SpriteRect[] = [[0, 0, 4, 5, '@b'], [0, 0, 4, 1, '@h'], [4, 1, 1, 3, '@s'], [0, 4, 4, 1, '@s']];
const STICKY: readonly SpriteRect[] = [[0, 2, 6, 6, '#FDE047'], [2, 0, 6, 6, '#F9A8D4'], [3, 2, 4, 1, '#BE185D'], [3, 4, 3, 1, '#BE185D']];
const BOTTLE: readonly SpriteRect[] = [[1, 0, 2, 1, '#F43F5E'], [0, 1, 4, 8, '#BAE6FD'], [0, 4, 4, 3, '#7DD3FC'], [1, 2, 1, 5, '#F0F9FF']];
const PILLS: readonly SpriteRect[] = [[0, 2, 12, 4, '#E5E7EB'], [0, 1, 2, 1, '#F87171'], [2, 1, 2, 1, '#FB923C'], [4, 1, 2, 1, '#FDE047'], [6, 1, 2, 1, '#4ADE80'], [8, 1, 2, 1, '#60A5FA'], [10, 1, 2, 1, '#A78BFA'], [2, 2, 1, 4, '#CBD5E1'], [5, 2, 1, 4, '#CBD5E1'], [8, 2, 1, 4, '#CBD5E1']];
const SHAKER: readonly SpriteRect[] = [[0, 0, 5, 2, '#111827'], [0, 2, 5, 8, '#E5E7EB'], [0, 6, 5, 4, '#C4B5FD'], [1, 3, 3, 1, '#94A3B8']];
const STAND: readonly SpriteRect[] = [[0, 0, 6, 1, '#1F2937'], [-1, 1, 1, 1, '#1F2937'], [6, 1, 1, 1, '#1F2937'], [-1, 2, 2, 3, '@b'], [5, 2, 2, 3, '@b'], [2, 1, 1, 8, '#334155'], [0, 9, 5, 1, '#334155']];
const CONTROLLER: readonly SpriteRect[] = [[1, 1, 10, 4, '#374151'], [0, 2, 1, 4, '#374151'], [11, 2, 1, 4, '#374151'], [2, 2, 1, 3, '#E5E7EB'], [1, 3, 3, 1, '#E5E7EB'], [8, 2, 1, 1, '#F472B6'], [9, 3, 1, 1, '#60A5FA'], [7, 3, 1, 1, '#4ADE80']];

// Pill organiser (CatDesk.dc.html:101) as 4 compartments, 8 wide.
const PILLS8: readonly SpriteRect[] = [[0, 2, 8, 4, '#E5E7EB'], [0, 1, 2, 1, '#F87171'], [2, 1, 2, 1, '#FDE047'], [4, 1, 2, 1, '#4ADE80'], [6, 1, 2, 1, '#A78BFA'], [2, 2, 1, 4, '#CBD5E1'], [5, 2, 1, 4, '#CBD5E1']];
// Game controller (CatDesk.dc.html:108), 8 wide: the d-pad left, two buttons right.
const CONTROLLER8: readonly SpriteRect[] = [[1, 1, 6, 4, '#374151'], [0, 2, 1, 3, '#374151'], [7, 2, 1, 3, '#374151'], [2, 2, 1, 3, '#E5E7EB'], [1, 3, 3, 1, '#E5E7EB'], [5, 2, 1, 1, '#F472B6'], [6, 3, 1, 1, '#60A5FA']];

const onDesk = (id: string, rects: readonly SpriteRect[], x: number, y: number, tint?: true): ItemArt => standingPiece(id, 'desk_item', rects, x, y, DESK_TOP, tint);

registerItems([
  onDesk('item.sticky', STICKY, 102, 64),
  onDesk('item.bottle', BOTTLE, 104, 63),
  onDesk('item.pills', PILLS8, 102, 66),
  onDesk('item.shaker', SHAKER, 103, 62),
  onDesk('item.stand', STAND, 103, 62, true),
  onDesk('item.controller', CONTROLLER8, 102, 66),
]);
registerIcons({
  'item.mug': MUG, 'item.sticky': STICKY, 'item.bottle': BOTTLE, 'item.pills': PILLS, 'item.shaker': SHAKER, 'item.stand': STAND, 'item.controller': CONTROLLER,
});

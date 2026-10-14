// Plants (CatFloor.dc.html "PLANTS"): each board sprite stands on the floor (y 108) in the front-right corner, on a
// soft shadow.
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { standingPiece } from './shared';

const FLOOR_ROW = 108;

/** The board's fern (CatFloor.dc.html:75). */
const fern = (a: string, b: string, c: string, pot: string, rim: string): SpriteRect[] => [[3, 20, 8, 7, pot], [2, 19, 10, 2, rim], [6, 12, 2, 7, a], [3, 14, 3, 2, b], [8, 13, 3, 2, b], [2, 11, 2, 3, c], [10, 10, 2, 3, c], [5, 9, 2, 3, b]];

// The board sprites, verbatim (CatFloor.dc.html:79-86).
const FERN: readonly SpriteRect[] = fern('#4ADE80', '#22C55E', '#16A34A', '#B45309', '#D97706');
const CACTUS: readonly SpriteRect[] = [[1, 9, 6, 5, '#C2410C'], [3, 0, 3, 9, '#65A30D'], [1, 3, 2, 3, '#65A30D'], [6, 2, 2, 3, '#65A30D'], [3, -1, 2, 1, '#F472B6']];
const MONSTERA: readonly SpriteRect[] = [[4, 20, 8, 7, '#E5E7EB'], [3, 19, 10, 2, '#F8FAFC'], [7, 6, 2, 13, '#15803D'], [1, 4, 6, 4, '#22C55E'], [8, 0, 7, 5, '#16A34A'], [2, 10, 5, 3, '#4ADE80'], [9, 9, 6, 3, '#22C55E']];
const SNAKE: readonly SpriteRect[] = [[2, 18, 9, 7, '#F1F5F9'], [3, 4, 2, 14, '#3F6212'], [6, 0, 2, 18, '#4D7C0F'], [9, 6, 2, 12, '#3F6212'], [3, 4, 1, 14, '#A3E635'], [6, 0, 1, 18, '#BEF264'], [9, 6, 1, 12, '#A3E635']];
const SUCCULENTS: readonly SpriteRect[] = [[0, 6, 16, 4, '#94A3B8'], [0, 6, 16, 1, '#CBD5E1'], [1, 3, 4, 3, '#86EFAC'], [2, 2, 2, 1, '#BBF7D0'], [6, 2, 4, 4, '#6EE7B7'], [7, 1, 2, 1, '#A7F3D0'], [11, 3, 4, 3, '#A3E635'], [12, 2, 2, 1, '#D9F99D'], [1, 3, 1, 1, '#F9A8D4'], [14, 3, 1, 1, '#F9A8D4']];
const BAMBOO: readonly SpriteRect[] = [[2, 16, 8, 8, '#E5E7EB'], [3, 17, 6, 6, '#BAE6FD'], [3, 0, 1, 17, '#65A30D'], [6, 3, 1, 14, '#65A30D'], [8, 1, 1, 16, '#65A30D'], [3, 5, 1, 1, '#3F6212'], [6, 9, 1, 1, '#3F6212'], [8, 7, 1, 1, '#3F6212'], [4, 0, 3, 1, '#4ADE80'], [9, 1, 2, 1, '#4ADE80'], [7, 3, 2, 1, '#4ADE80']];
const SUNFLOWER: readonly SpriteRect[] = [[5, 6, 2, 14, '#15803D'], [2, 12, 3, 2, '#22C55E'], [7, 10, 3, 2, '#22C55E'], [2, 0, 8, 6, '#FACC15'], [1, 1, 10, 4, '#FACC15'], [4, 2, 4, 2, '#78350F'], [3, 20, 6, 6, '#B45309']];

const onFloor = (id: string, rects: readonly SpriteRect[], x: number, y: number): ItemArt => standingPiece(id, 'plant', rects, x, y, FLOOR_ROW);

registerItems([
  onFloor('plant.cactus', CACTUS, 155, 94),
  onFloor('plant.monstera', MONSTERA, 151, 81),
  onFloor('plant.snake', SNAKE, 152, 83),
  onFloor('plant.succulents', SUCCULENTS, 151, 98),
  onFloor('plant.bamboo', BAMBOO, 152, 84),
  onFloor('plant.sunflower', SUNFLOWER, 153, 82),
]);
registerIcons({
  'plant.fern': FERN, 'plant.cactus': CACTUS, 'plant.monstera': MONSTERA, 'plant.snake': SNAKE, 'plant.succulents': SUCCULENTS, 'plant.bamboo': BAMBOO, 'plant.sunflower': SUNFLOWER,
});

// Pet pieces (CatFloor.dc.html "PETS"): the pet bed lies on the floor at KIP's front left (y 105), in KIP's colour.
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems } from '../items';
import { standingPiece } from './shared';

// The board sprite, verbatim (CatFloor.dc.html:124).
const BED: readonly SpriteRect[] = [[0, 0, 16, 5, '@b'], [2, 0, 12, 2, '@d'], [0, 4, 16, 1, '@s']];

registerItems([standingPiece('pet.bed', 'pet', BED, 35, 100, 105, true)]);
registerIcons({ 'pet.bed': BED });

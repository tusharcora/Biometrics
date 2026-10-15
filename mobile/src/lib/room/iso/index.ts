// Registers every piece's iso art (spec 2026-10-15 §4). The engine (room.ts) imports this once. The front-on art
// is registered first: billboards, wall art and desk tops are drawn from it.
import '../art';
import './pieces/stand';
import './pieces/wallArt';
import './pieces/desks';
import './pieces/rugs';
import './pieces/extras';

import { CATALOGUE, GEOMETRY_DEPS, catalogueSet, isoOf } from '../../src/lib/room/catalogue';
import { validateLayout } from '../../src/lib/room/iso/geometry';

it('carries the server\'s iso blocks, the starter layout and each set\'s layout, all valid in the app\'s rules too', () => {
  expect(isoOf('desk.monitor')?.kipDesk).toBe(true);
  expect(isoOf('wall.plain')).toBeUndefined();
  expect(isoOf('no.such')).toBeUndefined();
  expect(CATALOGUE.starterLayout.pieces).toHaveLength(7);
  expect(validateLayout(CATALOGUE.starterLayout, 1, GEOMETRY_DEPS)).toBeNull();
  expect(validateLayout(catalogueSet('cottage')!.layout, 1, GEOMETRY_DEPS)).toBeNull();
});

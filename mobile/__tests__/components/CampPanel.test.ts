import { nextStop, panelStops, snapStop, stepStop } from '../../src/components/social/CampPanel';
import { PEEK_RESERVE } from '../../src/components/social/campSceneGeometry';

it('rests at Peek above the home indicator, Half 40% down and Full 11% down', () => {
  expect(panelStops(844, { top: 47, bottom: 34 })).toEqual({ peek: 844 - 140, half: 338, full: 93 });
  // No home indicator: Peek is just its content.
  expect(panelStops(667, { top: 20, bottom: 0 })).toEqual({ peek: 667 - 106, half: 267, full: 73 });
  // Full never goes under the status bar; Peek never takes more than the scene keeps clear.
  expect(panelStops(667, { top: 80, bottom: 60 }).full).toBe(88);
  expect(panelStops(932, { top: 59, bottom: 60 }).peek).toBe(932 - PEEK_RESERVE);
});

it('snaps a drag to the nearest stop, carried by its velocity, never in between', () => {
  const stops = panelStops(844, { top: 47, bottom: 34 });
  expect(snapStop(stops, 690, 0)).toBe('peek');
  expect(snapStop(stops, 360, 0)).toBe('half');
  expect(snapStop(stops, 120, 0)).toBe('full');
  // A fling up from near Peek reaches Half; a hard one, Full.
  expect(snapStop(stops, 640, -1200)).toBe('half');
  expect(snapStop(stops, 400, -2400)).toBe('full');
  // A fling down from Full past Half lands at Peek.
  expect(snapStop(stops, 150, 3000)).toBe('peek');
});

it('steps: the handle goes up and wraps from Full to Peek; increment and decrement stop at the ends', () => {
  expect([nextStop('peek'), nextStop('half'), nextStop('full')]).toEqual(['half', 'full', 'peek']);
  expect([stepStop('peek', 1), stepStop('half', 1), stepStop('full', 1)]).toEqual(['half', 'full', 'full']);
  expect([stepStop('peek', -1), stepStop('half', -1), stepStop('full', -1)]).toEqual(['peek', 'peek', 'half']);
});

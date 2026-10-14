import {
  DEFAULT_KIP_COLOUR, KIP_COLOURS, KIP_GRID, KIP_MOODS, KIP_POSES, kipArt, kipBounds, kipGrid, kipPoseFrames, kipRamp, mirrorGrid, type KipColour,
} from '../../src/lib/kip/kipArt';

// Reference values come from the approved board's engine (docs/design/character/project/Final.dc.html), run
// with no skin on the plain body.
const RAMPS: Record<KipColour, { light: string; shade: string; deep: string; eyes: string }> = {
  coral: { light: '#fc95a4', shade: '#c45868', deep: '#974450', eyes: '#14161B' },
  cobalt: { light: '#6ca1f8', shade: '#2e65c0', deep: '#234e94', eyes: '#14161B' },
  ink: { light: '#5f636b', shade: '#21252d', deep: '#191c23', eyes: '#F5F5F4' },
  lemon: { light: '#fee875', shade: '#c5af37', deep: '#98862b', eyes: '#14161B' },
  lilac: { light: '#d3c8fe', shade: '#998dc5', deep: '#766d98', eyes: '#14161B' },
  lime: { light: '#baec68', shade: '#7fb329', deep: '#628a20', eyes: '#14161B' },
  mint: { light: '#92edc9', shade: '#56b48f', deep: '#428b6e', eyes: '#14161B' },
  sky: { light: '#9edefd', shade: '#62a5c5', deep: '#4b7f97', eyes: '#14161B' },
  slate: { light: '#8b97a8', shade: '#4e5a6c', deep: '#3c4653', eyes: '#F5F5F4' },
  snow: { light: '#f5f8fb', shade: '#bcbfc2', deep: '#919395', eyes: '#14161B' },
};

const RECTS_PER_POSE = { rest: 23, wave: 24, cheer: 25, bottle: 33, coffee: 30, stretch: 26, type: 23, think: 25, point: 23, shrug: 25 } as const;
const RECTS_PER_MOOD = { idle: 23, curious: 23, sleepy: 20, proud: 25, startled: 27, glance: 22, determined: 24 } as const;

// b body, s shade, e eyes, z ground shadow.
const REST_IDLE = [
  '................', '................', '................', '................', '................', '................',
  '....bbbbbbbs....', '....bbbbbbbs....', '....bbebbebs....', '....bbbbbbbs....', '....bbbbbbbs....', '....bbbbbbbs....',
  '....bbbbbbbs....', '.....b....s.....', '.....b....s.....', '...zzzzzzzzzz...',
];

function ascii(grid: (string | null)[][], colour: KipColour) {
  const r = kipRamp(KIP_COLOURS[colour]);
  const role: Record<string, string> = { [r.body]: 'b', [r.shade]: 's', [r.eyes]: 'e', [r.shadow]: 'z', [r.light]: 'h', [r.deep]: 'd' };
  return grid.map((row) => row.map((c) => (c === null ? '.' : role[c] ?? '*')).join(''));
}

describe('KIP colours', () => {
  it('lists the ten v1 colours, coral first and the default', () => {
    expect(KIP_COLOURS).toEqual({
      coral: '#FB7185', cobalt: '#3B82F6', ink: '#2A2F3A', lemon: '#FDE047', lilac: '#C4B5FD',
      lime: '#A3E635', mint: '#6EE7B7', sky: '#7DD3FC', slate: '#64748B', snow: '#F1F5F9',
    });
    expect(DEFAULT_KIP_COLOUR).toBe('coral');
  });
});

describe('kipRamp (GROUNDED lighting from one body colour)', () => {
  it.each(Object.keys(RAMPS) as KipColour[])('%s: light, shade, deep, eyes and ground shadow', (colour) => {
    const r = kipRamp(KIP_COLOURS[colour]);
    expect(r.body).toBe(KIP_COLOURS[colour]);
    expect(r).toMatchObject(RAMPS[colour]);
    expect(r.shadow).toBe('rgba(0,0,0,0.35)');
  });

  it('dark bodies get light eyes and light bodies get dark eyes (luminance 0.2)', () => {
    expect(kipRamp('#2A2F3A').eyes).toBe('#F5F5F4');
    expect(kipRamp('#64748B').eyes).toBe('#F5F5F4');
    expect(kipRamp('#000000').eyes).toBe('#F5F5F4');
    expect(kipRamp('#3B82F6').eyes).toBe('#14161B');
    expect(kipRamp('#FFFFFF').eyes).toBe('#14161B');
  });
});

describe('kipGrid', () => {
  it('draws the base body: rest pose, idle mood, default colour', () => {
    expect(ascii(kipGrid({}), 'coral')).toEqual(REST_IDLE);
    expect(ascii(kipGrid({ colour: 'coral', pose: 'rest', mood: 'idle' }), 'coral')).toEqual(REST_IDLE);
  });

  it('arms appear only in poses', () => {
    const rest = ascii(kipGrid({ pose: 'rest' }), 'coral');
    for (const row of rest) {
      expect(row.slice(0, 4)).not.toMatch(/[bs]/);
      expect(row.slice(12)).not.toMatch(/[bs]/);
    }
    const wave = ascii(kipGrid({ pose: 'wave' }), 'coral');
    expect(wave[8]).toBe('....bbebbebs.s..');
    expect(wave[9]).toBe('....bbbbbbbss...');
  });

  it('sleepy squashes the body down a row and widens the shadow', () => {
    const g = ascii(kipGrid({ mood: 'sleepy' }), 'coral');
    expect(g[6]).toBe('................');
    expect(g[8]).toBe('....beebbees....');
    expect(g[15]).toBe('..zzzzzzzzzzzz..');
  });

  it('every grid is 16 x 16', () => {
    for (const pose of KIP_POSES) for (const mood of KIP_MOODS) {
      const g = kipGrid({ pose, mood });
      expect(g).toHaveLength(KIP_GRID);
      for (const row of g) expect(row).toHaveLength(KIP_GRID);
    }
  });
});

describe('kipArt', () => {
  it.each(KIP_POSES)('pose %s has a stable rect count', (pose) => {
    expect(kipArt({ pose })).toHaveLength(RECTS_PER_POSE[pose]);
    expect(kipArt({ pose })).toEqual(kipArt({ pose }));
  });

  it.each(KIP_MOODS)('mood %s has a stable rect count', (mood) => {
    expect(kipArt({ mood })).toHaveLength(RECTS_PER_MOOD[mood]);
  });

  it('every rect fits the grid, is one row tall and at least one cell wide, for every colour, pose and mood', () => {
    for (const colour of Object.keys(KIP_COLOURS) as KipColour[]) for (const pose of KIP_POSES) for (const mood of KIP_MOODS) {
      for (const r of kipArt({ colour, pose, mood })) {
        expect(Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.w)).toBe(true);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.w).toBeGreaterThanOrEqual(1);
        expect(r.h).toBe(1);
        expect(r.x + r.w).toBeLessThanOrEqual(KIP_GRID);
        expect(r.y + r.h).toBeLessThanOrEqual(KIP_GRID);
      }
    }
  });

  it('merges each row into runs of one colour that cover exactly the grid cells', () => {
    const grid = kipGrid({ pose: 'coffee', mood: 'curious' });
    const painted: (string | null)[][] = Array.from({ length: KIP_GRID }, () => Array<string | null>(KIP_GRID).fill(null));
    for (const r of kipArt({ pose: 'coffee', mood: 'curious' })) for (let x = r.x; x < r.x + r.w; x++) {
      expect(painted[r.y]![x]).toBeNull();
      painted[r.y]![x] = r.fill;
    }
    expect(painted).toEqual(grid);
  });

  it('colours the body from the chosen colour', () => {
    const fills = new Set(kipArt({ colour: 'ink' }).map((r) => r.fill));
    const r = kipRamp(KIP_COLOURS.ink);
    expect(fills).toEqual(new Set([r.body, r.shade, r.eyes, r.shadow]));
  });
});

describe('kipBounds', () => {
  it('is the box of painted cells: rest is 10 x 10 with its shadow, from column 3, row 6', () => {
    expect(kipBounds({})).toEqual({ x: 3, y: 6, w: 10, h: 10 });
  });

  it('grows with arms (cheer) and held items (coffee)', () => {
    expect(kipBounds({ pose: 'cheer', mood: 'proud' })).toEqual({ x: 2, y: 4, w: 12, h: 12 });
    expect(kipBounds({ pose: 'coffee', mood: 'sleepy' })).toEqual({ x: 2, y: 7, w: 14, h: 9 });
  });
});

describe('KIP Coach poses (spec 2026-10-14 §4)', () => {
  const NEW = ['type', 'think', 'point', 'shrug'] as const;
  const COLOURS = ['coral', 'cobalt', 'lime'] as const;

  it.each(NEW)('%s only adds arm cells in cells rest leaves empty (body, legs, eyes untouched)', (pose) => {
    for (const mood of KIP_MOODS) for (let frame = 0; frame < kipPoseFrames(pose); frame++) {
      const rest = kipGrid({ pose: 'rest', mood });
      const posed = kipGrid({ pose, mood, frame });
      posed.forEach((row, y) => row.forEach((c, x) => {
        const was = rest[y]![x];
        if (was !== null) expect(c).toBe(was);
        else if (c !== null) expect([kipRamp(KIP_COLOURS.coral).body, kipRamp(KIP_COLOURS.coral).shade]).toContain(c);
      }));
    }
  });

  it('type has three frames that differ only in which arm is down', () => {
    expect(kipPoseFrames('type')).toBe(3);
    for (const p of ['rest', 'think', 'point', 'shrug'] as const) expect(kipPoseFrames(p)).toBe(1);
    const frames = [0, 1, 2].map((frame) => ascii(kipGrid({ pose: 'type', frame }), 'coral'));
    expect(new Set(frames.map((f) => f.join('\n'))).size).toBe(3);
    expect(frames[0]![11]).toBe('..bbbbbbbbbsss..');
    expect(frames[1]![12]).toBe('..bbbbbbbbbs....');
    expect(frames[2]![12]).toBe('....bbbbbbbsss..');
  });

  it('a frame number wraps, so a free-running clock can pass any integer', () => {
    expect(kipGrid({ pose: 'type', frame: 4 })).toEqual(kipGrid({ pose: 'type', frame: 1 }));
    expect(kipGrid({ pose: 'point', frame: 2 })).toEqual(kipGrid({ pose: 'point' }));
  });

  it('point reaches out at shoulder height on the left; shrug lifts both arms', () => {
    expect(ascii(kipGrid({ pose: 'point' }), 'coral')[8]).toBe('.bbbbbebbebs....');
    const shrug = ascii(kipGrid({ pose: 'shrug' }), 'coral');
    expect(shrug[7]).toBe('..b.bbbbbbbs.s..');
    expect(shrug[8]).toBe('...bbbebbebss...');
  });

  it('mirrorGrid flips left and right and nothing else', () => {
    const g = kipGrid({ pose: 'point', mood: 'glance' });
    const m = mirrorGrid(g);
    g.forEach((row, y) => expect(m[y]).toEqual([...row].reverse()));
    expect(mirrorGrid(m)).toEqual(g);
  });

  it.each(NEW.flatMap((pose) => COLOURS.map((colour) => [pose, colour] as const)))('%s in %s matches its snapshot', (pose, colour) => {
    const frames = Array.from({ length: kipPoseFrames(pose) }, (_, frame) => ascii(kipGrid({ colour, pose, frame }), colour).join('\n'));
    expect(frames).toMatchSnapshot();
  });
});

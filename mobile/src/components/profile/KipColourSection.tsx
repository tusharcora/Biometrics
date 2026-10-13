import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { saveKipColour } from '../../api/kip';
import { KIP_COLOURS, type KipColour } from '../../lib/kip/kipArt';
import { KIP_COLOUR_ORDER, kipColourName } from '../../lib/kip/kipColour';
import { setMyKipColour, useMyKipColour } from '../../lib/kip/myKipColour';
import { PROFILE_COPY } from '../../lib/profileCopy';
import type { PixelRect } from '../../lib/weatherArt';
import { Kip } from '../kip/Kip';
import { Button } from '../ui/button';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';

// The KIP colour page (Picker board, spec 2026-10-13 KIP colour §3): a preview on a small scene, 10 swatches,
// Reset and Save. Nothing changes anywhere until Save succeeds.

const C = PROFILE_COPY.kipColour;
const PREVIEW_W = 119;
const PREVIEW_H = 64;
const PREVIEW_GROUND = 52;
const UNIT = 3;
const HERO_SCALE = 6;
const KIP_CELLS = 16;

// The board's preview scene: a dithered dawn sky, a sun, and grass.
function previewScene(): PixelRect[] {
  const sky = ['#15233D', '#1A2B49', '#203456', '#273E63'];
  const band = Math.floor(PREVIEW_GROUND / 4);
  const r: PixelRect[] = [];
  sky.forEach((fill, i) => {
    const y = i * band;
    r.push({ x: 0, y, w: PREVIEW_W, h: i === 3 ? PREVIEW_GROUND - y : band, fill });
    if (i > 0) for (let x = i % 2; x < PREVIEW_W; x += 2) r.push({ x, y, w: 1, h: 1, fill: sky[i - 1]! });
  });
  for (const [x, y, w, h, fill] of [[103, 6, 6, 1, '#FDE68A'], [101, 7, 10, 1, '#FCD34D'], [100, 8, 12, 7, '#FBBF24'], [101, 15, 10, 1, '#F59E0B'], [103, 16, 6, 1, '#F59E0B']] as const) {
    r.push({ x, y, w, h, fill });
  }
  const g = ['#4A8A5C', '#3A7049', '#2D5A3A'];
  r.push({ x: 0, y: PREVIEW_GROUND, w: PREVIEW_W, h: 1, fill: g[0]! }, { x: 0, y: PREVIEW_GROUND + 1, w: PREVIEW_W, h: 2, fill: g[1]! }, { x: 0, y: PREVIEW_GROUND + 3, w: PREVIEW_W, h: PREVIEW_H - PREVIEW_GROUND - 3, fill: g[2]! });
  for (let x = 4; x < PREVIEW_W; x += 13) r.push({ x, y: PREVIEW_GROUND - 1, w: 1, h: 1, fill: g[0]! }, { x: x + 2, y: PREVIEW_GROUND - 1, w: 1, h: 1, fill: g[0]! });
  return r;
}
const SCENE = previewScene();

export function KipColourSection() {
  const saved = useMyKipColour();
  // null until you pick, so a colour that loads after the page opens still shows.
  const [choice, setChoice] = useState<KipColour | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const picked = choice ?? saved;
  const name = kipColourName(picked);

  async function save() {
    setBusy(true);
    setFailed(false);
    try {
      await saveKipColour(picked);
      setMyKipColour(picked);
      setChoice(null);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View testID="kip-colour-section" className="gap-[16px]">
      <View className="overflow-hidden rounded-card border border-border" style={{ height: PREVIEW_H * UNIT }}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: 0, top: 0 }}>
          <Svg width={PREVIEW_W * UNIT} height={PREVIEW_H * UNIT} viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}>
            {SCENE.map((p, i) => (
              <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} />
            ))}
          </Svg>
        </View>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={C.previewLabel(name)}
          style={{ position: 'absolute', left: 179 - (KIP_CELLS / 2) * HERO_SCALE, top: PREVIEW_GROUND * UNIT - 15 * HERO_SCALE }}
        >
          <Kip colour={picked} pose="wave" scale={HERO_SCALE} />
        </View>
        <View className="absolute left-[14px] top-[12px] gap-[2px]">
          <SectionLabel className="text-[#C7D2FE]">{C.yourKip}</SectionLabel>
          <Text className="text-headline font-semibold text-[#F5F5F4]">{C.picked(name, KIP_COLOURS[picked])}</Text>
        </View>
      </View>

      <View className="gap-[10px]">
        <View className="flex-row items-baseline justify-between">
          <SectionLabel>{C.colour}</SectionLabel>
          <Text className="text-fine text-muted-foreground">{C.buddiesSee}</Text>
        </View>
        <View
          testID="kip-colour-swatches"
          accessibilityRole="radiogroup"
          accessibilityLabel={C.groupLabel}
          className="flex-row flex-wrap justify-between gap-y-[10px]"
        >
          {KIP_COLOUR_ORDER.map((c) => {
            const on = c === picked;
            return (
              <View key={c} className="w-[18%] items-center gap-[4px]">
                <Button
                  testID={`kip-swatch-${c}`}
                  accessibilityRole="radio"
                  accessibilityLabel={kipColourName(c)}
                  accessibilityState={{ checked: on }}
                  variant={on ? 'default' : 'outline'}
                  className="h-[56px] w-full px-0"
                  onPress={() => setChoice(c)}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: KIP_COLOURS[c], borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)' }} />
                </Button>
                <Text className={on ? 'text-fine text-foreground' : 'text-fine text-muted-foreground'}>{kipColourName(c)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View className="flex-row gap-[8px]">
        <Button testID="kip-colour-reset" variant="outline" className="flex-1" onPress={() => setChoice('coral')}>
          {C.reset}
        </Button>
        <Button testID="kip-colour-save" className="flex-1" disabled={picked === saved || busy} loading={busy} onPress={save}>
          {C.save}
        </Button>
      </View>
      {failed ? (
        <View testID="kip-colour-error" className="flex-row items-center justify-between gap-3">
          <Text className="text-caption text-destructive">{C.failed}</Text>
          <Button testID="kip-colour-retry" variant="ghost" size="sm" onPress={save}>
            {C.retry}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

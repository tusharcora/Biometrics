import React, { useEffect, useRef, useState } from 'react';
import { Linking, PixelRatio, ScrollView, Switch, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { fetchRecap, type Recap } from '../api/recaps';
import { useCharacter } from '../characters/CharacterContext';
import { RecapCardView } from '../components/recap/RecapCardView';
import { WeeklyStoryView } from '../components/recap/WeeklyStoryView';
import { YearPixelsView } from '../components/recap/YearPixelsView';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { SegmentedControl } from '../components/ui/segmented-control';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { todayCivil } from '../lib/heatmap';
import { captureToPng, saveImage, shareImage } from '../lib/recapCapture';
import { readIncludePrefs, writeIncludePrefs } from '../lib/recapPrefs';
import {
  FORMAT_LABELS, INCLUDE_LABELS, availableIncludes, exportLayout, previewScale, recapCoachId, resolveIncludes,
  type IncludeKey, type Includes, type ShareFormat,
} from '../lib/recapShare';
import { loadYearInPixels, type YearInPixels } from '../lib/yearPixels';

const NOTICES = {
  saved: 'Saved to Photos.',
  denied: 'Photos access is off. Allow it in Settings to save images.',
  failed: "The image couldn't be made. Please try again.",
} as const;
type Notice = keyof typeof NOTICES;

// Build your recap (spec 2026-10-04 §3, 1c): pick a format, switch parts on and off, see a live
// preview (scaled, never captured), then Save image or Share. The export is a separate, fixed-size,
// off-screen view captured at 1080 / PixelRatio.get() points wide.
export function RecapBuilderScreen() {
  const { params } = useRoute<any>() as { params: { id?: string; format: ShareFormat } };
  const { characterId } = useCharacter();
  const { width } = useWindowDimensions();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [year, setYear] = useState<YearInPixels | null>(null);
  const [format, setFormat] = useState<ShareFormat>(params.format);
  const [prefs, setPrefs] = useState<Partial<Includes>>({});
  // The format whose stored choices have loaded: until then an export could miss a switched-off part.
  const [prefsFormat, setPrefsFormat] = useState<ShareFormat | null>(null);
  const [recapFailed, setRecapFailed] = useState(false);
  const [yearFailed, setYearFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const exportRef = useRef<View>(null);
  // Two presses in one frame both see busy === false; the ref lets only the first through.
  const inFlight = useRef(false);

  useEffect(() => {
    if (!params.id) return;
    fetchRecap(params.id).then(setRecap, () => setRecapFailed(true));
  }, [params.id]);

  useEffect(() => {
    if (format !== 'year' || year || yearFailed) return;
    loadYearInPixels(todayCivil()).then(setYear, () => setYearFailed(true));
  }, [format, year, yearFailed]);

  useEffect(() => {
    let cancelled = false;
    setPrefs({});
    setPrefsFormat(null);
    // A switch flipped while the stored choices load wins over them.
    void readIncludePrefs(format).then((stored) => {
      if (cancelled) return;
      setPrefs((current) => ({ ...stored, ...current }));
      setPrefsFormat(format);
    });
    return () => {
      cancelled = true;
    };
  }, [format]);

  const formats: ShareFormat[] = recap ? [recap.kind === 'MONTH' ? 'card' : 'story', 'year'] : [params.format];
  const stats = format === 'year' ? null : recap?.stats ?? null;
  const includes = resolveIncludes(format, prefs, stats);
  const available = availableIncludes(format, stats);
  const ready = format === 'year' ? year !== null : recap !== null;
  const layout = exportLayout(format, PixelRatio.get());
  const canExport = ready && prefsFormat === format && !busy;
  const loadError = format === 'year' ? (yearFailed ? "Your year couldn't be loaded." : null) : recapFailed ? 'Your recap could not be loaded.' : null;

  function toggle(key: IncludeKey, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    void writeIncludePrefs(format, next);
  }

  function renderView(scale: number, testID: string) {
    if (format === 'year') {
      return year ? <YearPixelsView testID={testID} year={year.year} pixels={year.pixels} goalMinutes={year.goalMinutes} coachId={characterId} includes={includes} scale={scale} palette="dark" /> : null;
    }
    if (!recap) return null;
    // The card and story show the recap's own coach, whose voice wrote the line (ruling S6).
    const coachId = recapCoachId(recap, characterId);
    return format === 'card' ? (
      <RecapCardView testID={testID} recap={recap} coachId={coachId} includes={includes} scale={scale} />
    ) : (
      <WeeklyStoryView testID={testID} recap={recap} coachId={coachId} includes={includes} scale={scale} />
    );
  }

  async function run(after: (uri: string) => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice(null);
    try {
      let uri: string;
      try {
        uri = await captureToPng(exportRef);
      } catch {
        setNotice('failed');
        return;
      }
      await after(uri);
    } catch {
      setNotice('failed');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 20 }}>
        {formats.length > 1 ? (
          <SegmentedControl testID="builder-format" options={formats.map((f) => ({ value: f, label: FORMAT_LABELS[f] }))} value={format} onChange={setFormat} />
        ) : null}
        <View testID="builder-preview" className="items-center">
          {ready ? renderView(previewScale(format, width - 40, 460), 'preview') : <Skeleton className="h-72 w-full rounded-card" />}
        </View>
        <Text testID="builder-privacy" className="text-center text-xs text-muted-foreground">
          Only you see this until you share
        </Text>
        {available.length > 0 ? (
          <Card className="gap-1">
            {available.map((key) => (
              <View key={key} className="flex-row items-center justify-between py-2">
                <Text className="text-base">{INCLUDE_LABELS[key]}</Text>
                <Switch testID={`builder-include-${key}`} accessibilityLabel={INCLUDE_LABELS[key]} value={includes[key]} onValueChange={(v) => toggle(key, v)} />
              </View>
            ))}
          </Card>
        ) : null}
        {notice ? (
          <Text testID="builder-notice" className={notice === 'saved' ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'}>
            {NOTICES[notice]}
          </Text>
        ) : null}
        {notice === 'denied' ? (
          <Button testID="builder-open-settings" variant="secondary" size="sm" onPress={() => void Linking.openSettings()}>
            Open Settings
          </Button>
        ) : null}
        {loadError ? (
          <View className="gap-2">
            <Text testID="builder-load-error" className="text-sm text-destructive">
              {loadError}
            </Text>
            {format === 'year' ? (
              <Button testID="builder-retry" variant="secondary" size="sm" onPress={() => setYearFailed(false)}>
                Try again
              </Button>
            ) : null}
          </View>
        ) : null}
        <View className="flex-row gap-3">
          <Button testID="builder-save" className="flex-1" variant="secondary" disabled={!canExport} onPress={() => void run(async (uri) => setNotice((await saveImage(uri)) === 'saved' ? 'saved' : 'denied'))}>
            Save image
          </Button>
          <Button testID="builder-share" className="flex-1" disabled={!canExport} onPress={() => void run((uri) => shareImage(uri))}>
            Share
          </Button>
        </View>
      </ScrollView>
      {/* The export view: fixed size, off screen, the only thing captured (spec §3). */}
      {ready ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0 }}>
          <View ref={exportRef} collapsable={false} testID="builder-export" style={{ width: layout.width, height: layout.height }}>
            {renderView(layout.scale, 'export')}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

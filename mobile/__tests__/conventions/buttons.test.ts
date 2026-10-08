import fs from 'fs';
import path from 'path';

// The button standard (src/components/ui/README.md): every button is
// components/ui/button. This guard reads every file under src as text and
// fails on a hand-rolled one: a raw Pressable / PressableScale / Touchable* /
// Text that says it is a button (accessibilityRole="button" or role="button").
//
// The only raw pressables allowed to say "button" are the ones that are not
// buttons in the design sense (rows, navigating cards, tabs, toggle chips,
// story rings, tap zones) plus one documented custom CTA. Each is listed below
// by file and testID, with its reason. A new entry needs the same: if it is a
// button, use <Button> instead.

const SRC = path.join(__dirname, '../../src');
const BUTTON_FILE = 'components/ui/button.tsx';

const RAW_TAGS = [
  'Pressable',
  'PressableScale',
  'AnimatedPressable',
  'Animated.Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'Text',
  'Animated.Text',
];
const TAG_START = new RegExp(`<(${RAW_TAGS.map((t) => t.replace('.', '\\.')).join('|')})(?=[\\s/>])`, 'g');
// accessibilityRole="button", role='button', accessibilityRole={'button'}, role={"button"}.
const BUTTON_ROLE = /\b(?:accessibilityRole|role)\s*=\s*(?:\{\s*)?(['"`])button\1/;
const TEST_ID = /\btestID\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\}|\{\s*([^}]*?)\s*\})/;

type Exception = { file: string; testID: string; reason: string };

// prettier-ignore
const ALLOWED: Exception[] = [
  // List and settings rows
  { file: 'components/buddies/BuddyListRow.tsx', testID: 'buddy-row-${row.id}', reason: 'a buddy list row that opens the buddy' },
  { file: 'screens/BuddiesScreen.tsx', testID: 'activity-${item.id}', reason: 'an activity feed row that opens the item' },
  { file: 'screens/BadgesScreen.tsx', testID: 'badges-row-${family}', reason: 'a badge family row that opens its detail' },
  { file: 'screens/CoachScreen.tsx', testID: 'coach-suggestion-${index}', reason: 'a suggested-question row in the empty chat' },
  { file: 'components/coach/PromptBar.tsx', testID: 'coach-command-${command.key}', reason: 'a row of the slash-command menu' },
  { file: 'screens/SleepScreen.tsx', testID: 'sleep-goal-row', reason: 'the bedtime goal settings row (a card that navigates)' },
  // Cards and tiles that navigate
  { file: 'screens/RecapsScreen.tsx', testID: 'testID', reason: 'a recap card that opens the recap' },
  { file: 'screens/RecapsScreen.tsx', testID: 'recaps-year', reason: 'the Year in Pixels card' },
  { file: 'screens/RecapScreen.tsx', testID: 'recap-story-preview', reason: 'the story preview card that opens the story viewer' },
  { file: 'screens/MetricsScreen.tsx', testID: 'trend-card-${type}', reason: 'a metric trend card that opens its detail' },
  { file: 'screens/MetricsScreen.tsx', testID: 'patterns-button', reason: 'the Patterns card' },
  { file: 'screens/MeetYourCoachScreen.tsx', testID: 'meet-tile-${id}', reason: 'a coach tile in the picker grid' },
  { file: 'components/tomorrow-card.tsx', testID: 'tomorrow-card', reason: 'the forecast card that opens Tomorrow' },
  { file: 'components/coach-digest-card.tsx', testID: 'coach-digest-card', reason: 'the digest card that opens the coach' },
  { file: 'components/home/recovery-hero.tsx', testID: 'recovery-score-card', reason: 'the home hero score card that opens its detail' },
  { file: 'components/home/coach-tile.tsx', testID: 'coach-entry-button', reason: 'the home coach tile' },
  { file: 'components/home/metric-tile.tsx', testID: 'metric-card-${type}', reason: 'a home metric tile' },
  { file: 'components/home/sleep-tile.tsx', testID: 'sleep-score-unavailable', reason: 'the home sleep tile (no data state)' },
  { file: 'components/home/sleep-tile.tsx', testID: 'sleep-score-empty', reason: 'the home sleep tile (empty state)' },
  { file: 'components/home/sleep-tile.tsx', testID: 'sleep-score-card', reason: 'the home sleep tile' },
  { file: 'components/home/BuddiesRow.tsx', testID: 'home-buddies-row', reason: 'the home buddies strip that opens Buddies' },
  { file: 'components/recap/RecapShelf.tsx', testID: 'recap-shelf-item-${item.id}', reason: 'a recap card on the shelf' },
  { file: 'components/achievements/BadgesCard.tsx', testID: 'badges-card-${family}', reason: 'a badge tile on the home card' },
  { file: 'components/activity/UsualTiles.tsx', testID: 'usual-tile-${tile.type}', reason: 'a usual-range tile that opens the metric' },
  { file: 'components/activity-sheets.tsx', testID: 'testID', reason: 'LinkTile, a tile that opens a detail sheet' },
  { file: 'components/sleep/WindowChart.tsx', testID: 'sleep-window-bar-${bar.date}', reason: 'a chart bar that opens its night' },
  { file: 'components/coach/TodayBar.tsx', testID: 'today-bar-${bar.metric}', reason: 'a metric bar that asks the coach about it' },
  { file: 'components/social/CampBanner.tsx', testID: 'camp-banner', reason: 'the camp banner strip that opens the Campfire' },
  // Tabs
  { file: 'navigation/FloatingTabBar.tsx', testID: 'tab-${route.name}', reason: 'a tab bar item' },
  // Story rings, avatars and scene characters
  { file: 'components/social/StoriesRow.tsx', testID: 'story-me', reason: 'my story ring' },
  { file: 'components/social/StoriesRow.tsx', testID: 'story-${r.author.id}', reason: "a buddy's story ring" },
  { file: 'screens/DashboardScreen.tsx', testID: 'settings-button', reason: 'the profile avatar (with its story ring)' },
  { file: 'screens/SettingsScreen.tsx', testID: 'profile-avatar', reason: 'the profile avatar wearing a recap ring' },
  { file: 'components/social/CampScene.tsx', testID: 'camp-coach-${id}', reason: 'a coach seat in the Campfire scene' },
  // Toggle and selection chips
  { file: 'components/habit-log-card.tsx', testID: 'habit-type-${habit.type}', reason: 'a habit type toggle chip' },
  { file: 'components/habit-log-card.tsx', testID: 'checkin-day-${day.habitDay}', reason: 'a check-in day toggle cell' },
  // Backdrops and tap zones
  { file: 'components/ui/sheet.tsx', testID: '${testID}-backdrop', reason: 'the sheet backdrop (tap to dismiss)' },
  { file: 'screens/SocialStoryScreen.tsx', testID: 'social-story-prev', reason: 'the left story tap zone' },
  { file: 'screens/SocialStoryScreen.tsx', testID: 'social-story-next', reason: 'the right story tap zone' },
  // The documented custom exception
  { file: 'screens/ScoreDetailScreen.tsx', testID: 'ask-coach-button', reason: 'Ask Coach, a GlassSurface CTA with the character (kept custom by plan)' },
];

type Found = { file: string; line: number; tag: string; testID: string };

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
  });
}

/** The attribute text of the JSX opening tag that starts at `from`: up to its closing `>` at brace depth 0. */
function openingTag(source: string, from: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === quote && source[i - 1] !== '\\') quote = null;
    } else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (depth === 0 && (c === '"' || c === "'")) quote = c;
    else if (depth === 0 && c === '>') return source.slice(from, i + 1);
  }
  return source.slice(from);
}

/** Every raw pressable / Text in `source` that claims the button role. */
function findHandRolledButtons(file: string, source: string): Found[] {
  const found: Found[] = [];
  for (const match of source.matchAll(TAG_START)) {
    const tag = openingTag(source, match.index!);
    if (!BUTTON_ROLE.test(tag)) continue;
    const id = tag.match(TEST_ID);
    found.push({
      file,
      line: source.slice(0, match.index).split('\n').length,
      tag: match[1],
      testID: id ? (id[1] ?? id[2] ?? id[3] ?? id[4]) : '',
    });
  }
  return found;
}

function scan(): Found[] {
  return sourceFiles(SRC)
    .map((full) => path.relative(SRC, full).split(path.sep).join('/'))
    .filter((file) => file !== BUTTON_FILE)
    .flatMap((file) => findHandRolledButtons(file, fs.readFileSync(path.join(SRC, file), 'utf8')));
}

const isAllowed = (f: Found) => ALLOWED.some((a) => a.file === f.file && a.testID === f.testID);

describe('button convention', () => {
  const found = scan();

  it('has no hand-rolled buttons: use <Button> from components/ui/button', () => {
    const offenders = found
      .filter((f) => !isAllowed(f))
      .map((f) => `src/${f.file}:${f.line} <${f.tag}${f.testID ? ` testID=${f.testID}` : ''}> has the button role`);
    expect(offenders).toEqual([]);
  });

  it('keeps the allowlist current: every entry still matches a site, with a reason', () => {
    const stale = ALLOWED.filter((a) => !found.some((f) => f.file === a.file && f.testID === a.testID)).map(
      (a) => `${a.file} ${a.testID}`,
    );
    expect(stale).toEqual([]);
    for (const a of ALLOWED) expect(a.reason.trim()).not.toBe('');
  });

  it('catches the role in every form, on every raw tag', () => {
    const cases = [
      '<Pressable accessibilityRole="button" onPress={go}>',
      "<PressableScale testID=\"x\" role='button'>",
      '<TouchableOpacity accessibilityRole={"button"} />',
      '<TouchableHighlight onPress={() => go(a > b)} accessibilityRole="button">',
      '<Text onPress={go} accessibilityRole={`button`}>Go</Text>',
    ];
    for (const snippet of cases) expect(findHandRolledButtons('x.tsx', snippet)).toHaveLength(1);
    // Other roles, other tags and the role on a prop name that only contains it are fine.
    expect(findHandRolledButtons('x.tsx', '<Pressable accessibilityRole="link" onPress={go}>')).toHaveLength(0);
    expect(findHandRolledButtons('x.tsx', '<Button accessibilityRole="button" />')).toHaveLength(0);
    expect(findHandRolledButtons('x.tsx', '<TextInput accessibilityRole="button" />')).toHaveLength(0);
    expect(findHandRolledButtons('x.tsx', '<View role="group" />')).toHaveLength(0);
  });

  it('reads the testID in each form', () => {
    expect(findHandRolledButtons('x.tsx', '<Pressable testID={`row-${id}`} accessibilityRole="button">')[0].testID).toBe('row-${id}');
    expect(findHandRolledButtons('x.tsx', '<Pressable testID={testID} accessibilityRole="button">')[0].testID).toBe('testID');
    expect(findHandRolledButtons('x.tsx', "<Pressable testID='a' accessibilityRole=\"button\">")[0].testID).toBe('a');
  });
});

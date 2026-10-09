import fs from 'fs';
import path from 'path';
import { openingTag, sourceFiles } from '../../jest-mocks/sourceScan';

// The type system (docs/superpowers/specs/2026-10-08-type-system-design.md):
// every text size in src is a token from tailwind.config.js (text-score,
// text-number, text-display, text-heading, text-headline, text-body,
// text-caption, text-fine, text-page-title, text-label), the face comes from
// ui/text, and every TextInput takes the shared input style. This guard reads
// every file under src as text, comments included (so name a token in a
// comment, never a banned class), and fails on:
//   - an arbitrary size: text-[13px]
//   - a stock size: text-xs, sm, base, lg, xl, 2xl … 9xl (NativeWind's rem is
//     14, so these draw 12.5% small, and they are not the scale)
//   - an old token: text-eyebrow, text-numeral*, text-display-sm, text-display-lg
//   - the serif: font-display
//   - an inline fontFamily: or fontSize:
//   - a <TextInput> whose own tag does not use inputTextStyle or inputNumberStyle
//
// EXEMPT lists the files that keep some of these for good, with how many and
// why. PENDING lists the files the migration has not reached yet; each
// migration task deletes its files from it. A count must match exactly: more is
// a new violation, fewer is a stale entry.

const SRC = path.join(__dirname, '../../src');

type Rule = { id: string; pattern: RegExp; fix: string };

const RULES: Rule[] = [
  { id: 'arbitrary size', pattern: /(?<![\w-])text-\[\d[^\]]*\]/g, fix: 'use a type token (text-body, text-caption, …)' },
  { id: 'stock size', pattern: /(?<![\w-])text-(?:xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/g, fix: 'use a type token (text-body, text-caption, …)' },
  { id: 'old token', pattern: /(?<![\w-])text-(?:eyebrow|numeral(?:-sm|-lg|-xl)?|display-(?:sm|lg))(?![\w-])/g, fix: 'see the migration map (spec §4)' },
  { id: 'serif', pattern: /(?<![\w-])font-display(?![\w-])/g, fix: 'the serif is gone: PageTitle, text-heading or text-display' },
  { id: 'inline font', pattern: /\bfont(?:Family|Size)\s*:/g, fix: 'use a type token on a ui/text Text' },
];
// A JSX TextInput tag, not a type argument such as useRef<TextInput>.
const INPUT_START = /(?<![\w.])<TextInput(?=[\s/>])/g;
const INPUT_STYLE = /\binput(?:Text|Number)Style\b/;

type Hit = { file: string; line: number; rule: string; text: string };
type Exception = { file: string; count: number; reason: string };

// prettier-ignore
const EXEMPT: Exception[] = [
  // The Campfire scene (spec §6): its Silkscreen sizes (8–14), letter-spacing and Geist text render exactly as before.
  { file: 'components/social/CampScene.tsx', count: 11, reason: 'the Campfire scene: labels, z-z-z, note bubbles and kicker at their own pixel sizes (spec §6)' },
  { file: 'components/social/CampBanner.tsx', count: 3, reason: 'the camp banner: THE CAMP in pixel 10 over its line (spec §6)' },
  { file: 'components/social/CampNoteCard.tsx', count: 7, reason: 'the Campfire note card keeps its panel text as it is (spec §6); only its input took inputTextStyle (spec §3)' },
  // Share cards (spec §5): images scaled by u() / a(), so their sizes stay inline; Geist and pixel only.
  { file: 'components/recap/WeeklyStoryView.tsx', count: 39, reason: 'the weekly story share card, sized in card units (spec §5)' },
  { file: 'components/recap/RecapCardView.tsx', count: 14, reason: 'the monthly recap share card, sized in card units (spec §5)' },
  { file: 'components/recap/YearPixelsView.tsx', count: 16, reason: 'the Year in Pixels share card, sized in card units (spec §5)' },
  { file: 'components/achievements/BadgeShareCard.tsx', count: 6, reason: 'the badge share card, sized in card units (spec §5)' },
  { file: 'components/achievements/CelebrationModal.tsx', count: 10, reason: 'the badge celebration, drawn like the share card (spec §5)' },
  { file: 'lib/recapShare.ts', count: 2, reason: "the share cards' quote fitting: fontSize is a number it computes, not a style" },
  // SVG <Text> sized in chart units would be exempt too (spec §5); there is none today: the charts draw their labels with ui/text.
  // The primitives that turn tokens into styles.
  { file: 'components/ui/text.tsx', count: 3, reason: 'the Text primitive sets fontFamily from the class list (and reads font-display until Task 11)' },
  { file: 'components/ui/input-style.ts', count: 4, reason: 'the shared input styles: Geist at the body size (spec §3)' },
  { file: 'navigation/headerStyle.tsx', count: 4, reason: 'native headers sit outside NativeWind: Silkscreen 15 (spec §3); the style and its return type, which HeaderTitle draws with' },
];

// prettier-ignore
const PENDING: Exception[] = [
  // Task 6
  { file: 'components/coach-digest-card.tsx', count: 9, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/CoachToday.tsx', count: 9, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/TodayBar.tsx', count: 3, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/AnswerCard.tsx', count: 8, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/CoachMessageRow.tsx', count: 6, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/ConversationsSheet.tsx', count: 6, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/ErrorCard.tsx', count: 1, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/PromptBar.tsx', count: 2, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/thinking/Bouncy.tsx', count: 2, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/thinking/Dialog.tsx', count: 5, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/thinking/Lines.tsx', count: 4, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/thinking/Nameplate.tsx', count: 2, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/thinking/Placeholder.tsx', count: 3, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/thinking/Shimmer.tsx', count: 3, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/thinking/Steps.tsx', count: 3, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/thinking/Strip.tsx', count: 2, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/thinking/Tag.tsx', count: 3, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach/thinking/Typewriter.tsx', count: 1, reason: 'not migrated yet (Task 6)' },
  { file: 'components/characters/CoachCard.tsx', count: 6, reason: 'not migrated yet (Task 6)' },
  { file: 'screens/CoachScreen.tsx', count: 10, reason: 'not migrated yet (Task 6)' },
  { file: 'screens/CoachConsentScreen.tsx', count: 5, reason: 'not migrated yet (Task 6)' },
  { file: 'screens/CoachMemoryScreen.tsx', count: 7, reason: 'not migrated yet (Task 6)' },
  { file: 'screens/HostedConsentScreen.tsx', count: 4, reason: 'not migrated yet (Task 6)' },
  { file: 'screens/MeetYourCoachScreen.tsx', count: 3, reason: 'not migrated yet (Task 6)' },
  { file: 'screens/ThinkingStyleScreen.tsx', count: 4, reason: 'not migrated yet (Task 6)' },
  { file: 'screens/ThinkingTextScreen.tsx', count: 5, reason: 'not migrated yet (Task 6)' },
  { file: 'components/memory-edit-form.tsx', count: 2, reason: 'not migrated yet (Task 6)' },
  { file: 'components/memory-proposal-chips.tsx', count: 2, reason: 'not migrated yet (Task 6)' },
  { file: 'components/coach-settings-section.tsx', count: 1, reason: 'not migrated yet (Task 6)' },
  { file: 'components/ai-engine-row.tsx', count: 3, reason: 'not migrated yet (Task 6)' },
  // Task 7
  { file: 'screens/SocialScreen.tsx', count: 4, reason: 'not migrated yet (Task 7)' },
  { file: 'screens/SocialStoryScreen.tsx', count: 1, reason: 'not migrated yet (Task 7)' },
  { file: 'components/social/SocialStoryFrame.tsx', count: 9, reason: 'not migrated yet (Task 7)' },
  { file: 'components/social/StoriesRow.tsx', count: 2, reason: 'not migrated yet (Task 7)' },
  { file: 'components/social/TimelineList.tsx', count: 4, reason: 'not migrated yet (Task 7)' },
  { file: 'components/social/CheckInSheet.tsx', count: 4, reason: 'not migrated yet (Task 7)' },
  { file: 'components/social/GoodnightButton.tsx', count: 2, reason: 'not migrated yet (Task 7)' },
  { file: 'components/social/HighlightsCarousel.tsx', count: 4, reason: 'not migrated yet (Task 7)' },
  { file: 'screens/HighlightsScreen.tsx', count: 4, reason: 'not migrated yet (Task 7)' },
  { file: 'screens/CampfireScreen.tsx', count: 16, reason: 'not migrated yet (Task 7)' },
  { file: 'components/buddies/BuddyListRow.tsx', count: 1, reason: 'not migrated yet (Task 7)' },
  { file: 'components/buddies/HandleSetupForm.tsx', count: 3, reason: 'not migrated yet (Task 7)' },
  { file: 'components/buddies/MoodNoticeSheet.tsx', count: 3, reason: 'not migrated yet (Task 7)' },
  { file: 'components/buddies/SharingConsentSheet.tsx', count: 3, reason: 'not migrated yet (Task 7)' },
  { file: 'screens/BuddiesScreen.tsx', count: 1, reason: 'not migrated yet (Task 7)' },
  { file: 'screens/BuddyWeekScreen.tsx', count: 9, reason: 'not migrated yet (Task 7)' },
  { file: 'screens/PairUpScreen.tsx', count: 7, reason: 'not migrated yet (Task 7)' },
  { file: 'screens/BlockedPeopleScreen.tsx', count: 2, reason: 'not migrated yet (Task 7)' },
  // Task 8
  { file: 'components/chats/ChatComposer.tsx', count: 3, reason: 'not migrated yet (Task 8)' },
  { file: 'components/chats/ChatRow.tsx', count: 4, reason: 'not migrated yet (Task 8)' },
  { file: 'components/chats/ChatSettingsSection.tsx', count: 2, reason: 'not migrated yet (Task 8)' },
  { file: 'components/chats/MessageBubble.tsx', count: 10, reason: 'not migrated yet (Task 8)' },
  { file: 'components/chats/NewChatSheet.tsx', count: 3, reason: 'not migrated yet (Task 8)' },
  { file: 'components/chats/NoteComposerSheet.tsx', count: 5, reason: 'not migrated yet (Task 8)' },
  { file: 'components/chats/NotesRow.tsx', count: 3, reason: 'not migrated yet (Task 8)' },
  { file: 'components/chats/ReportSheet.tsx', count: 5, reason: 'not migrated yet (Task 8)' },
  { file: 'components/chats/RequestsList.tsx', count: 4, reason: 'not migrated yet (Task 8)' },
  { file: 'screens/ChatsScreen.tsx', count: 4, reason: 'not migrated yet (Task 8)' },
  { file: 'screens/ChatThreadScreen.tsx', count: 5, reason: 'not migrated yet (Task 8)' },
  { file: 'screens/ChatRequestsScreen.tsx', count: 2, reason: 'not migrated yet (Task 8)' },
  // Task 9
  { file: 'components/recap/RecapShelf.tsx', count: 5, reason: 'not migrated yet (Task 9)' },
  { file: 'components/recap/ShareWithBuddiesButton.tsx', count: 5, reason: 'not migrated yet (Task 9)' },
  { file: 'screens/RecapScreen.tsx', count: 11, reason: 'not migrated yet (Task 9)' },
  { file: 'screens/RecapsScreen.tsx', count: 6, reason: 'not migrated yet (Task 9)' },
  { file: 'screens/RecapStoryScreen.tsx', count: 6, reason: 'not migrated yet (Task 9)' },
  { file: 'screens/RecapBuilderScreen.tsx', count: 6, reason: 'not migrated yet (Task 9)' },
  { file: 'screens/YearInPixelsScreen.tsx', count: 1, reason: 'not migrated yet (Task 9)' },
  { file: 'components/achievements/BadgesCard.tsx', count: 5, reason: 'not migrated yet (Task 9)' },
  { file: 'components/milestones/MilestoneTiles.tsx', count: 4, reason: 'not migrated yet (Task 9)' },
  { file: 'screens/BadgesScreen.tsx', count: 6, reason: 'not migrated yet (Task 9)' },
  { file: 'screens/BadgeDetailScreen.tsx', count: 10, reason: 'not migrated yet (Task 9)' },
  // Task 10
  { file: 'screens/SettingsScreen.tsx', count: 5, reason: 'not migrated yet (Task 10)' },
  { file: 'screens/SignInScreen.tsx', count: 6, reason: 'not migrated yet (Task 10)' },
  { file: 'screens/SignUpScreen.tsx', count: 4, reason: 'not migrated yet (Task 10)' },
  { file: 'screens/ForgotPasswordScreen.tsx', count: 5, reason: 'not migrated yet (Task 10)' },
  { file: 'screens/ResetPasswordScreen.tsx', count: 5, reason: 'not migrated yet (Task 10)' },
  { file: 'screens/SignInMethodsScreen.tsx', count: 3, reason: 'not migrated yet (Task 10)' },
  { file: 'screens/DevicesScreen.tsx', count: 1, reason: 'not migrated yet (Task 10)' },
  { file: 'screens/ConnectHealthScreen.tsx', count: 6, reason: 'not migrated yet (Task 10)' },
  { file: 'components/notifications-section.tsx', count: 2, reason: 'not migrated yet (Task 10)' },
  { file: 'components/delete-account-section.tsx', count: 5, reason: 'not migrated yet (Task 10)' },
  { file: 'screens/dev/CharacterGalleryScreen.tsx', count: 3, reason: 'not migrated yet (Task 10)' },
];

const ALLOWED = [...EXEMPT, ...PENDING];

const lineOf = (source: string, index: number) => source.slice(0, index).split('\n').length;

/** Every guard hit in one file. */
function findViolations(file: string, source: string): Hit[] {
  const hits: Hit[] = [];
  for (const rule of RULES) {
    for (const m of source.matchAll(rule.pattern)) {
      hits.push({ file, line: lineOf(source, m.index!), rule: rule.id, text: `${m[0]}: ${rule.fix}` });
    }
  }
  for (const m of source.matchAll(INPUT_START)) {
    if (!INPUT_STYLE.test(openingTag(source, m.index!))) {
      hits.push({ file, line: lineOf(source, m.index!), rule: 'input', text: '<TextInput> without inputTextStyle: style={[inputTextStyle, …]}' });
    }
  }
  return hits.sort((a, b) => a.line - b.line);
}

/** Each hit in a file with no entry, and each entry whose file has a different number of hits. */
function violations(hits: Hit[], allowed: Exception[]): string[] {
  const out: string[] = [];
  const files = [...new Set(hits.map((h) => h.file))];
  for (const file of files) {
    const mine = hits.filter((h) => h.file === file);
    const entry = allowed.find((a) => a.file === file);
    if (!entry) for (const h of mine) out.push(`src/${h.file}:${h.line} ${h.rule}, ${h.text}`);
    else if (mine.length !== entry.count) out.push(`src/${file}: expected ${entry.count}, found ${mine.length} (lines ${mine.map((h) => h.line).join(', ')})`);
  }
  for (const a of allowed) if (!files.includes(a.file)) out.push(`src/${a.file}: expected ${a.count}, found 0`);
  return out;
}

function scan(): Hit[] {
  return sourceFiles(SRC)
    .map((full) => path.relative(SRC, full).split(path.sep).join('/'))
    .flatMap((file) => findViolations(file, fs.readFileSync(path.join(SRC, file), 'utf8')));
}

// One file's entries, for checking that file alone (the rest would read as stale).
const entriesFor = (file: string) => ALLOWED.filter((a) => a.file === file);

describe('typography convention', () => {
  it('uses the type scale everywhere outside the listed files', () => {
    expect(violations(scan(), ALLOWED)).toEqual([]);
  });

  it('gives every entry one file, a count and a reason, and keeps exempt and pending apart', () => {
    const files = ALLOWED.map((a) => a.file);
    expect(new Set(files).size).toBe(files.length);
    for (const a of ALLOWED) {
      expect(a.reason.trim()).not.toBe('');
      expect(a.count).toBeGreaterThan(0);
    }
  });

  it('fails a deliberately re-added text-[13px] in a migrated file', () => {
    const file = 'components/ui/section-label.tsx';
    const source = fs.readFileSync(path.join(SRC, file), 'utf8') + '\nexport const Again = () => <Text className="text-[13px] text-muted-foreground">x</Text>;\n';
    const line = source.split('\n').length - 1;
    expect(violations(findViolations(file, source), entriesFor(file))).toEqual([
      `src/${file}:${line} arbitrary size, text-[13px]: use a type token (text-body, text-caption, …)`,
    ]);
  });

  it('fails one more inline size in an exempt file', () => {
    const file = 'components/social/CampScene.tsx';
    const source = fs.readFileSync(path.join(SRC, file), 'utf8') + '\nconst extra = { fontSize: 9 };\n';
    expect(violations(findViolations(file, source), entriesFor(file))).toEqual([expect.stringMatching(/^src\/components\/social\/CampScene\.tsx: expected 11, found 12/)]);
  });

  it('catches every stock size, in any variant, but not the tokens or the colours', () => {
    for (const cls of ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'dark:text-sm']) {
      expect(findViolations('x.tsx', `<Text className="${cls}">x</Text>`)).toHaveLength(1);
    }
    expect(findViolations('x.tsx', '<ScoreRing numeralClassName="text-lg" />')).toHaveLength(1);
    const fine = ['text-body', 'text-caption', 'text-fine', 'text-label', 'text-page-title', 'text-score', 'text-score-excellent', 'text-display', 'text-[#A5B4FC]', 'text-muted-foreground'];
    for (const cls of fine) expect(findViolations('x.tsx', `<Text className="${cls}">x</Text>`)).toEqual([]);
  });

  it('catches the old tokens and the serif', () => {
    for (const cls of ['text-eyebrow', 'text-numeral', 'text-numeral-sm', 'text-numeral-lg', 'text-numeral-xl', 'text-display-sm', 'text-display-lg', 'font-display']) {
      expect(findViolations('x.tsx', `<Text className="${cls}">x</Text>`)).toHaveLength(1);
    }
  });

  it('catches an inline fontFamily or fontSize, and nothing else in a style', () => {
    expect(findViolations('x.tsx', '<Text style={{ fontSize: 12 }}>x</Text>')).toHaveLength(1);
    expect(findViolations('x.tsx', '<Text style={{ fontFamily: FONTS.sans, fontSize: 12 }}>x</Text>')).toHaveLength(2);
    expect(findViolations('x.tsx', "<Text style={{ fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: 1 }}>x</Text>")).toEqual([]);
  });

  it('catches a TextInput without the shared input style, and only a JSX tag', () => {
    expect(findViolations('x.tsx', '<TextInput value={v} className="flex-1" />').map((h) => h.rule)).toEqual(['input']);
    expect(findViolations('x.tsx', '<TextInput /* inputTextStyle */ value={v} />').map((h) => h.rule)).toEqual(['input']);
    expect(findViolations('x.tsx', '<TextInput value={v} style={[inputTextStyle, { height: 40 }]} />')).toEqual([]);
    expect(findViolations('x.tsx', '<TextInput\n  value={v}\n  style={inputNumberStyle}\n/>')).toEqual([]);
    expect(findViolations('x.tsx', 'const input = useRef<TextInput>(null); type P = React.RefObject<TextInput | null>;')).toEqual([]);
  });

  it('flags a stale entry', () => {
    expect(violations([], [{ file: 'x.tsx', count: 1, reason: 'gone' }])).toEqual(['src/x.tsx: expected 1, found 0']);
  });
});

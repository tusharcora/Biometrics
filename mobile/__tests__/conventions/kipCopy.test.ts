import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { sourceFiles } from '../../jest-mocks/sourceScan';

// Spec §7.6: user-facing strings say KIP, never "Coach", and none of the 15 retired names survive. Each file is
// parsed (comments are not nodes) and only its string literals, template pieces and JSX text are checked: for
// "Coach" in src/screens, src/components, src/lib and src/navigation, for the names in all of src. Route names
// and type names are allowed.
const SRC = path.join(__dirname, '../../src');
const DIRS = ['screens', 'components', 'lib', 'navigation'].map((d) => path.join(SRC, d));
const RETIRED = ['Mochi', 'Boba', 'Sprout', 'Avo', 'Peep', 'Bun', 'Kit', 'Axo', 'Boo', 'Cap', 'Jelly', 'Pengu', 'Luna', 'Gloop', 'Bao'];
const ALLOWED = new Set([
  // Route names (deep links and navigateToCoachEntry keep them; spec §7.1).
  'Coach', 'CoachConsent', 'CoachMemory',
]);

/** Every string a user could read in `file`: string literals, template pieces and JSX text. */
function literals(file: string, text = fs.readFileSync(file, 'utf8')): string[] {
  const kind = /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)
      || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
      out.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

const FILES = DIRS.flatMap((d) => sourceFiles(d));

it('reads literals, template pieces and JSX text, and skips comments', () => {
  const text = "// Coach in a comment\nconst a = 'one';\nconst b = `two ${a} three`;\nconst c = <Text>Don't four</Text>;\n";
  expect(literals('x.tsx', text)).toEqual(['one', 'two ', ' three', "Don't four"]);
});

/** A string that names the coach: "Coach" as a word, or "your / the / their / and coach" in any case. */
const saysCoach = (s: string) => (/\bCoach\b/.test(s) && !ALLOWED.has(s.trim())) || /\b(your|the|their|and) coach\b/i.test(s);

it('flags "Coach" and "your / the / their / and coach", but not route names or other words', () => {
  const named = ['AI Coach', 'Asks your coach about it', 'What the coach sees', 'Your Coach', "their coach's mood", 'your mood and coach'];
  expect(named.filter(saysCoach)).toEqual(named);
  expect(['Coach', 'CoachMemory', 'coach-digest-card', 'Asks KIP', 'coaching'].filter(saysCoach)).toEqual([]);
});

it('no user-facing string says "Coach" or "your / the / their / and coach"', () => {
  const hits = FILES.flatMap((f) => literals(f).filter(saysCoach).map((s) => `${path.relative(SRC, f)}: ${s}`));
  expect(hits).toEqual([]);
});

// "Cap" is also a worn item (spec 2026-10-14 KIP's room, CatOutfit.dc.html:70): its display name in roomCopy.ts is the
// one allowed use. Any other "Cap" string still fails.
const NAME_EXCEPTIONS = new Set(['lib/room/roomCopy.ts: Cap']);

it('none of the 15 retired coach names appear in any string anywhere in src', () => {
  const all = sourceFiles(SRC);
  const name = new RegExp(`\\b(${RETIRED.join('|')})\\b`);
  const hits = all.flatMap((f) => literals(f).filter((s) => name.test(s)).map((s) => `${path.relative(SRC, f)}: ${s}`));
  expect(hits.filter((h) => !NAME_EXCEPTIONS.has(h))).toEqual([]);
});

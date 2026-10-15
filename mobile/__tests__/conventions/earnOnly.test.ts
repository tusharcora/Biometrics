import fs from 'fs';
import path from 'path';
import { sourceFiles } from '../../jest-mocks/sourceScan';

// Earn only (spec 2026-10-15 §0, §6.1): no purchase, payment or ad library in either package, and no app source that
// sells coins, prices anything in money, sells a subscription or shows an ad. Coins never come from money.
const ROOT = path.join(__dirname, '../../..');

// A package is a money package when any segment of its name (split on @ / . _ -) is one of these words, so
// "react-native-google-mobile-ads" is caught by "ads" while "uploads" or "threads" never are. revenuecat and fbads are
// vendors whose purchase and ad packages carry no other money word. No current dependency matches, so there are no
// exemptions; one would be listed here with its reason.
const MONEY_SEGMENT = /^(iap|purchases?|stripe|admob|ads|billing|paypal|braintree|adyen|applovin|ironsource|revenuecat|fbads)$/;
const EXEMPT: ReadonlyMap<string, string> = new Map();
const isMoneyDep = (name: string) => !EXEMPT.has(name) && name.split(/[@/._-]/).some((s) => MONEY_SEGMENT.test(s.toLowerCase()));

// Real-money copy anywhere in a source file. A dollar price is "$5", "$1/month" or "$0.99"; a regex back-reference
// ("$1" as a .replace replacement) is not copy, so replacement arguments are dropped before the scan.
const MONEY_COPY = /get more coins|buy coins|coin pack|in-app purchase|watch an ad|remove ads|[£€¥]|\$\d+(?:\.\d\d)?(?!\d)|\b(USD|EUR|GBP)\b/i;
// Subscription and premium copy: only inside a quoted string on one line, since `subscription` is also an ordinary
// identifier (a notification listener's handle).
const PAID_TIER_COPY = /(['"`])(?:(?!\1)[^\n])*?\b(subscriptions?|premium)\b(?:(?!\1)[^\n])*?\1/i;
const REPLACEMENT_ARG = /\.replace(?:All)?\([^;\n]*?,\s*(['"`])(?:(?!\1)[^\n])*\1\s*\)/g;
const sellsForMoney = (source: string) => {
  const text = source.replace(REPLACEMENT_ARG, '.replace()');
  return MONEY_COPY.test(text) || PAID_TIER_COPY.test(text);
};

type Pkg = { dependencies?: object; devDependencies?: object; optionalDependencies?: object; peerDependencies?: object };

it('neither package depends on a purchase, payment or ad library', () => {
  for (const pkg of ['mobile/package.json', 'backend/package.json']) {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, pkg), 'utf8')) as Pkg;
    const deps = Object.keys({ ...json.dependencies, ...json.devDependencies, ...json.optionalDependencies, ...json.peerDependencies });
    expect(deps.length).toBeGreaterThan(0);
    expect({ pkg, money: deps.filter(isMoneyDep) }).toEqual({ pkg, money: [] });
  }
});

it('no app source sells coins, prices anything in money, sells a subscription or shows an ad', () => {
  const hits = sourceFiles(path.join(ROOT, 'mobile/src')).filter((f) => sellsForMoney(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  expect(hits).toEqual([]);
});

it('the guard itself catches money packages and money copy, and lets the rest through (a pin, so it can fail)', () => {
  const money = [
    'react-native-iap', 'expo-in-app-purchases', 'react-native-purchases', 'react-native-purchases-ui', '@revenuecat/purchases-capacitor',
    'expo-ads-admob', 'react-native-google-mobile-ads', '@react-native-firebase/admob', 'react-native-admob', 'react-native-fbads',
    'stripe', '@stripe/stripe-react-native', 'react-native-billing', 'braintree-web', '@adyen/react-native', 'react-native-applovin-max',
  ];
  const fine = ['react-native', 'expo-crypto', 'react-native-uploads', 'threads', 'ioredis', '@shopify/react-native-skia', 'bullmq'];
  expect(money.filter((d) => !isMoneyDep(d))).toEqual([]);
  expect(fine.filter(isMoneyDep)).toEqual([]);

  const copy = [
    'Buy coins', 'Get more coins: $0.99', '£2 coin pack', 'Watch an ad for 10', "const t = 'Only $5';", 'const p = "$1/month";',
    "title: 'Go premium'", 'label: `Start your subscription`', "line: \"KIP's premium room\"",
  ];
  const clean = [
    'Healthy days earn coins, up to 60 a day.', 'Coin shop', "x.replace(/(\\d+) hours/, '$1 hour').replace(/(\\d+) minutes/, '$1 minute');",
    'let subscription: { remove(): void } | undefined;', 'subscription?.remove();', 'const s = `${n} coins`;',
  ];
  expect(copy.filter((s) => !sellsForMoney(s))).toEqual([]);
  expect(clean.filter(sellsForMoney)).toEqual([]);
});

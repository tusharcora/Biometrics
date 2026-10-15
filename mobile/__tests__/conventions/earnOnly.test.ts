import fs from 'fs';
import path from 'path';
import { sourceFiles } from '../../jest-mocks/sourceScan';

// Earn only (spec 2026-10-15 §0, §6.1): no purchase or ad library in either package, and no app source that sells
// coins, prices anything in money or shows an ad. Coins never come from money.
const ROOT = path.join(__dirname, '../../..');
const MONEY_DEPS = /^(react-native-iap|expo-in-app-purchases|react-native-purchases|@revenuecat\/.+|expo-ads-.+|react-native-google-mobile-ads|@react-native-firebase\/admob|react-native-fbads)$/;
const MONEY_COPY = /get more coins|buy coins|coin pack|in-app purchase|watch an ad|remove ads|[£€¥]|\$\d+\.\d\d|\b(USD|EUR|GBP)\b/i;

it('neither package depends on a purchase or ad library', () => {
  for (const pkg of ['mobile/package.json', 'backend/package.json']) {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, pkg), 'utf8')) as { dependencies?: object; devDependencies?: object };
    const deps = Object.keys({ ...json.dependencies, ...json.devDependencies });
    expect({ pkg, money: deps.filter((d) => MONEY_DEPS.test(d)) }).toEqual({ pkg, money: [] });
  }
});

it('no app source sells coins, prices anything in money or shows an ad', () => {
  const hits = sourceFiles(path.join(ROOT, 'mobile/src')).filter((f) => MONEY_COPY.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  expect(hits).toEqual([]);
});

it('the guard itself catches a purchase library and money copy (a pin, so it can fail)', () => {
  expect(['react-native-iap', '@revenuecat/purchases-capacitor', 'expo-ads-admob', 'react-native', 'expo-crypto'].map((d) => MONEY_DEPS.test(d))).toEqual([true, true, true, false, false]);
  expect(['Buy coins', 'Get more coins: $0.99', '£2 coin pack', 'Watch an ad for 10', 'Healthy days earn coins, up to 60 a day.', 'Coin shop'].map((s) => MONEY_COPY.test(s))).toEqual([true, true, true, true, false, false]);
});

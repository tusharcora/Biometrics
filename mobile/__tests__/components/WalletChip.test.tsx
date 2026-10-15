import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { WalletChip } from '../../src/components/coins/WalletChip';
import { resetCoins, setCoinBalance } from '../../src/lib/coins/coinsStore';

jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

beforeEach(() => { jest.clearAllMocks(); resetCoins(); });

it('shows nothing until the wallet has loaded', () => {
  expect(render(<WalletChip />).queryByTestId('wallet')).toBeNull();
});

it('is a 44-point outline button with the coin and the balance, labelled for screen readers (spec §6.7, ruling 9)', async () => {
  const s = render(<WalletChip />);
  await act(async () => { setCoinBalance(1500); });
  const chip = s.getByTestId('wallet');
  expect([chip.props.accessibilityRole, chip.props.accessibilityLabel]).toEqual(['button', '1,500 KIP coins. Open coin history']);
  const classes = String(chip.props.className).split(' ');
  // At least 44 points, growing with the (capped) text size rather than clipping it (ruling T10-FIX).
  expect([classes.includes('min-h-[44px]'), classes.some((c) => /^h-\[/.test(c)), classes.includes('border-border')]).toEqual([true, false, true]);
  expect(s.getByText('1,500').props.maxFontSizeMultiplier).toBe(1.3);
  // Tabular figures by the class, never an inline fontVariant (ruling PF-F10).
  expect(String(s.getByText('1,500').props.className).split(' ')).toContain('tabular-nums');
  fireEvent.press(chip);
  expect(mockNavigate).toHaveBeenCalledWith('CoinHistory', undefined);
});

it('from the shop, the history leaves out its own way back to the shop', async () => {
  const s = render(<WalletChip from="shop" />);
  await act(async () => { setCoinBalance(5); });
  fireEvent.press(s.getByTestId('wallet'));
  expect(mockNavigate).toHaveBeenCalledWith('CoinHistory', { from: 'shop' });
});

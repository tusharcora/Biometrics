import React from 'react';
import { act, render } from '@testing-library/react-native';
import { COLLAPSED_HEIGHT, COLLAPSED_ROW_HEIGHT, FADE_PT, CollapsedKipHeader, collapseProgress } from '../../src/components/coach/CollapsedKipHeader';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { resetMyKip } from '../../src/lib/kip/myKip';
import { kipStage } from '../../src/lib/kipStage';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn() }));

afterEach(() => { resetCosmetics(); resetMyKip(); });

const STAGE = kipStage({ phase: 'ready', statusUnverified: false, offline: false, waiting: false, streaming: false, error: false, empty: false, idle: { pose: 'rest', mood: 'idle' } });

/** The collapsed header; `props` overrides the defaults. */
function renderHeader(props: Partial<React.ComponentProps<typeof CollapsedKipHeader>> = {}) {
  return render(
    <CollapsedKipHeader
      stage={STAGE}
      look={{ pose: 'rest', mood: 'idle', facing: 'you' }}
      statusLine="Here"
      window={{ weather: 'cloudy', night: false }}
      reduceMotion={false}
      onExpand={jest.fn()}
      onConversations={jest.fn()}
      onNewChat={jest.fn()}
      showActions
      {...props}
    />,
  );
}

it('the collapsed header is 60 points, its row 72, and the fade 24 points', () => {
  expect([COLLAPSED_HEIGHT, COLLAPSED_ROW_HEIGHT, FADE_PT]).toEqual([60, 72, 24]);
});

it('pinned over the scroll (60 points covered): 0 → 1 over the 24 points before the card\'s bottom passes under it', () => {
  expect(collapseProgress(228, 312)).toBe(0);
  expect(collapseProgress(240, 312)).toBe(0.5);
  expect(collapseProgress(252, 312)).toBe(1);
  expect(collapseProgress(900, 312)).toBe(1);
});

it('pinned over a header above the scroll: only the measured overlap counts', () => {
  // The 72-point row over a 60-point expanded header reaches 12 points over the scroll.
  expect(collapseProgress(276, 312, 12)).toBe(0);
  expect(collapseProgress(288, 312, 12)).toBe(0.5);
  expect(collapseProgress(300, 312, 12)).toBe(1);
});

it('a header taller than the row covers nothing: the fade ends as the card leaves the scroll\'s top', () => {
  expect(collapseProgress(312, 312, -8)).toBe(1);
  expect(collapseProgress(300, 312, -8)).toBe(0.5);
});

it('the thumbnail draws your saved layout and what KIP wears', async () => {
  const layout = { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.dots' } };
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ layout, worn: { ...EMPTY_WORN, head: 'out.cap' } }));
  await act(async () => { await loadCosmetics(); });
  const thumb = renderHeader().getByTestId('kip-room-thumb');
  expect([JSON.parse(thumb.props.layout), thumb.props.tier, JSON.parse(thumb.props.worn).head]).toEqual([layout, 1, 'out.cap']);
});

it('pauses the thumbnail while decorate mode is open', () => {
  expect(renderHeader().getByTestId('kip-room-thumb').props.room).not.toContain(':paused');
  expect(renderHeader({ paused: true }).getByTestId('kip-room-thumb').props.room).toContain(':paused');
});

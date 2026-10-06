import { createContext, useContext, useEffect, type Context } from 'react';
import * as Navigation from '@react-navigation/native';
import { refreshBuddies } from './buddiesStore';

interface FocusSource {
  addListener?: (event: 'focus', callback: () => void) => () => void;
}

// Some suites mock @react-navigation/native without NavigationContext; fall back to a context that
// is always empty so this hook still runs (mount only), outside a navigator too.
const NO_NAVIGATION = createContext<FocusSource | undefined>(undefined);
const NavigationContext = ((Navigation as { NavigationContext?: unknown }).NavigationContext ?? NO_NAVIGATION) as Context<FocusSource | undefined>;

/** Reloads the shared buddies on mount and each time the surrounding screen comes back into focus. */
export function useRefreshBuddiesOnFocus(): void {
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    void refreshBuddies();
    return navigation?.addListener?.('focus', () => void refreshBuddies());
  }, [navigation]);
}

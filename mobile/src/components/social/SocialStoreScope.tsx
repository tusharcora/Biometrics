import { useEffect } from 'react';
import { AppState } from 'react-native';
import { refreshSocial, resetSocial } from '../../lib/socialStore';

// Mounted once inside the signed-in navigator: loads the Social home on start and on every return to the
// foreground (keeps the tab dot current); signing out unmounts it and forgets it.
export function SocialStoreScope() {
  useEffect(() => {
    void refreshSocial();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshSocial();
    });
    return () => {
      sub.remove();
      resetSocial();
    };
  }, []);
  return null;
}

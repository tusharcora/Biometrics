import { useEffect } from 'react';
import { loadMyKipColour, resetMyKip } from '../../lib/kip/myKip';
import { loadCosmetics, resetCosmetics } from '../../lib/room/cosmeticsStore';
import { clearToasted } from '../../lib/room/toasted';

// Mounted once inside the signed-in navigator: loads your KIP's colour and its room and worn pieces; signing out
// unmounts it and forgets them, and the pieces this device toasted for that account.
export function MyKipScope() {
  useEffect(() => {
    void loadMyKipColour();
    void loadCosmetics();
    return () => {
      resetMyKip();
      resetCosmetics();
      void clearToasted();
    };
  }, []);
  return null;
}

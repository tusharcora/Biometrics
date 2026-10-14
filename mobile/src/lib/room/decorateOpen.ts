// Whether decorate mode is open (ruling 17): the KIP page's room and thumbnail pause their loops while it is.
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();
export function setDecorateOpen(next: boolean): void {
  open = next;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export function useDecorateOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => open);
}

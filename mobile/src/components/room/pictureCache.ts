import type { SkPicture } from '@shopify/react-native-skia';

// The room's picture caches (spec 2026-10-15 §3.7, P3 rulings 11-13). Recording happens only on a miss: a pose, a
// static room, a mover's sprite. An animation tick, a walk step, a sway or a bob only reads them. A render only ever
// adds; what goes is released after the commit with what the committed tree draws (`trim`, `keep`: PF3-DISPOSE), so
// a render React throws away never disposes a picture still on screen.

/**
 * A small LRU of picture sets: KIP's three frames per pose, the static room's pictures and loop frames, a mover's
 * sprite. A set may belong to one static room (its isoRoomKey): once the drawn room has another key it goes.
 */
export class PictureLru {
  private readonly map = new Map<string, { set: SkPicture[]; room: string | null }>();
  constructor(private readonly capacity: number) {}
  get(key: string, make: () => SkPicture[], room: string | null = null): SkPicture[] {
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
      return hit.set;
    }
    const set = make();
    this.map.set(key, { set, room });
    return set;
  }
  /**
   * After a commit, with the keys the committed tree draws and its static room: releases every set of another room,
   * then the oldest sets past the capacity. A drawn set never goes.
   */
  trim(drawn: ReadonlySet<string>, room: string | null): void {
    for (const [key, e] of this.map) {
      if (drawn.has(key) || e.room === null || e.room === room) continue;
      this.release(key);
    }
    for (const key of this.map.keys()) {
      if (this.map.size <= this.capacity) break;
      if (!drawn.has(key)) this.release(key);
    }
  }
  get size(): number {
    return this.map.size;
  }
  clear(): void {
    for (const key of [...this.map.keys()]) this.release(key);
  }
  private release(key: string): void {
    this.map.get(key)?.set.forEach((p) => p.dispose?.());
    this.map.delete(key);
  }
}

/** One picture per floor piece, by its content key (IsoRun.key): a drop or a minute re-records only what changed. */
export class RunPictures {
  private readonly map = new Map<string, SkPicture>();
  take(key: string, make: () => SkPicture): SkPicture {
    let pic = this.map.get(key);
    if (!pic) {
      pic = make();
      this.map.set(key, pic);
    }
    return pic;
  }
  /** After a commit: releases every picture whose key the drawn room no longer has (kept while KIP sits: T9-FIX M2). */
  keep(keys: ReadonlySet<string>): void {
    for (const [key, pic] of this.map) {
      if (keys.has(key)) continue;
      pic.dispose?.();
      this.map.delete(key);
    }
  }
  clear(): void {
    for (const pic of this.map.values()) pic.dispose?.();
    this.map.clear();
  }
}

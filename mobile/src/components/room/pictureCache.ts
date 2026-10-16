import type { SkPicture } from '@shopify/react-native-skia';

// The room's picture caches (spec 2026-10-15 §3.7, P3 rulings 11-13). Recording happens only on a miss: a pose, a
// static room, a mover's sprite. An animation tick, a walk step, a sway or a bob only reads them. A render only ever
// adds; what goes is released after the commit (`trim`, `keep`: PF3-DISPOSE), so a render React throws away never
// disposes a picture the committed tree still draws.

/** A small LRU of picture sets: KIP's three frames per pose, the loop frames per static room, a mover's sprite. */
export class PictureLru {
  private readonly map = new Map<string, SkPicture[]>();
  /** Keys read since the last trim: the committed tree may draw them, so they stay. */
  private readonly used = new Set<string>();
  constructor(private readonly capacity: number) {}
  get(key: string, make: () => SkPicture[]): SkPicture[] {
    this.used.add(key);
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
      return hit;
    }
    const made = make();
    this.map.set(key, made);
    return made;
  }
  /** After a commit: releases the oldest sets past the capacity, never one read since the last trim. */
  trim(): void {
    for (const [key, set] of this.map) {
      if (this.map.size <= this.capacity) break;
      if (this.used.has(key)) continue;
      this.map.delete(key);
      set.forEach((p) => p.dispose?.());
    }
    this.used.clear();
  }
  get size(): number {
    return this.map.size;
  }
  clear(): void {
    for (const set of this.map.values()) set.forEach((p) => p.dispose?.());
    this.map.clear();
    this.used.clear();
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
  /** After a commit: releases every picture whose key the drawn room no longer has. */
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

import type { Response } from 'express';

/** Private, never cached: the one copy every per-user answer uses (plan ruling PF-F14). */
export const noStore = (res: Response) => res.set('Cache-Control', 'private, no-store');

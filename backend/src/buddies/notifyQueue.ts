// Buddy pushes never run inside a request (buddies spec §6). A route enqueues ONE 'buddyNotify'
// job per would-be notification event — whatever the recipient's mute, settings or quiet hours,
// and whether or not the request is hidden or swallowed — so the route's work and response time
// never depend on them. The JOB decides: a buddy_request whose row is hidden or no longer PENDING
// is dropped (only a visible request gets its REQUEST Activity row, written here); everything else
// goes through sendBuddyNotice (setting, mute, quiet hours, devices). The enqueue is bounded by
// withTimeout: on a timeout or error it logs the event, ids and error class, and the caller carries on.

import type { BuddyPushKind, PushSender } from '../coach/push';
import { prisma } from '../db/client';
import { withTimeout } from '../lib/withTimeout';
import { syncQueue } from '../sync/queue';
import { sendBuddyNotice, type BuddyNotice, type NoticeOutcome } from './notify';

export const BUDDY_NOTIFY_JOB = 'buddyNotify';
export const NOTIFY_ENQUEUE_TIMEOUT_MS = 300;
export const NOTIFY_JOB_OPTIONS = { removeOnComplete: true, removeOnFail: true, attempts: 2, backoff: { type: 'exponential', delay: 30_000 } } as const;

export interface NotifyQueue {
  add(name: string, data: BuddyNotice, opts?: object): Promise<unknown>;
}

let overrideQueue: NotifyQueue | null = null;

/** Test seam, like setPushSender: null falls back to the shared sync queue. */
export function setBuddyNotifyQueue(queue: NotifyQueue | null): void {
  overrideQueue = queue;
}

export function getBuddyNotifyQueue(): NotifyQueue {
  return overrideQueue ?? (syncQueue as unknown as NotifyQueue);
}

export async function enqueueBuddyNotice<K extends BuddyPushKind>(
  notice: BuddyNotice<K>,
  opts: { queue?: NotifyQueue; timeoutMs?: number } = {},
): Promise<void> {
  // Rebuilt field by field: the job data is exactly the notice, nothing else.
  const data: BuddyNotice = { kind: notice.kind, recipientId: notice.recipientId, actorId: notice.actorId, refId: notice.refId, slots: notice.slots };
  try {
    await withTimeout((opts.queue ?? getBuddyNotifyQueue()).add(BUDDY_NOTIFY_JOB, data, NOTIFY_JOB_OPTIONS), opts.timeoutMs ?? NOTIFY_ENQUEUE_TIMEOUT_MS, 'buddy notify enqueue timeout');
  } catch (err) {
    console.error(JSON.stringify({
      event: 'buddies.notify_enqueue_failed',
      kind: notice.kind,
      recipientId: notice.recipientId,
      actorId: notice.actorId,
      error: err instanceof Error ? err.name : 'unknown',
    }));
  }
}

export type NotifyJobOutcome = NoticeOutcome | 'dropped';

export async function runBuddyNotifyJob(data: BuddyNotice, deps: { pushSender: PushSender; now: Date }): Promise<NotifyJobOutcome> {
  if (data.kind === 'buddy_request') {
    const row = await prisma.buddyRequest.findFirst({
      where: { id: data.refId, fromUserId: data.actorId, toUserId: data.recipientId, status: 'PENDING', hidden: false },
      select: { id: true, createdAt: true },
    });
    // Swallowed, sent to someone who blocked the sender, or already answered: nothing, silently.
    if (!row) return 'dropped';
    await prisma.buddyActivity.createMany({
      data: [{ recipientId: data.recipientId, actorId: data.actorId, kind: 'REQUEST', refId: row.id, createdAt: row.createdAt }],
      skipDuplicates: true,
    });
  }
  return sendBuddyNotice(deps.pushSender, data, deps.now);
}

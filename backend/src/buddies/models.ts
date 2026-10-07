// The social tables (Buddies spec §3, Social tab S1 and S2). None has a `userId`, so the
// USER_OWNED_MODELS guard (tests/users/deletion.test.ts) does not see them; they rely on
// database cascades instead, and tests/buddies/deletion.test.ts introspects the schema against
// this list so a future social table must be added here (and to that test's seed).

export const SOCIAL_MODELS = [
  'BuddyPair',
  'BuddyRequest',
  'BuddyCode',
  'BuddyBlock',
  'BuddyMute',
  'Sticker',
  'BuddyActivity',
  'HandleHold',
  'CheckIn',
  'StorySeen',
  'RecapShare',
  'StepGoalEvent',
  'WeeklyHighlights',
  'Goodnight',
  'CampNote',
] as const;

export type SocialModel = (typeof SOCIAL_MODELS)[number];

/** Every column of a social model that holds a User id, by role. */
export const SOCIAL_USER_COLUMNS: Readonly<Record<SocialModel, readonly string[]>> = {
  BuddyPair: ['userAId', 'userBId'],
  BuddyRequest: ['fromUserId', 'toUserId'],
  BuddyCode: ['ownerId', 'usedById'],
  BuddyBlock: ['blockerId', 'blockedId'],
  BuddyMute: ['muterId', 'mutedId'],
  Sticker: ['fromUserId', 'toUserId'],
  BuddyActivity: ['recipientId', 'actorId'],
  HandleHold: ['previousOwnerId'],
  CheckIn: ['authorId'],
  StorySeen: ['viewerId', 'authorId'],
  RecapShare: ['sharerId'],
  StepGoalEvent: ['authorId'],
  WeeklyHighlights: ['viewerId'],
  Goodnight: ['authorId'],
  CampNote: ['authorId'],
};

/** `Model.column` pairs whose foreign key sets null instead of cascading. */
export const SET_NULL_COLUMNS: ReadonlySet<string> = new Set(['BuddyCode.usedById', 'HandleHold.previousOwnerId']);

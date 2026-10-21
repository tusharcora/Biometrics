-- The challenge judging's outcome, stored when an entry is judged (P4 ruling T7-FIX): a circle member deleted later
-- never changes an entrant's rank or win.
ALTER TABLE "ChallengeEntry" ADD COLUMN "ranked" BOOLEAN;
ALTER TABLE "ChallengeEntry" ADD COLUMN "won" BOOLEAN;

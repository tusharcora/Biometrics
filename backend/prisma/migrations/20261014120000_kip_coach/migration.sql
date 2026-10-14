-- KIP Coach (spec 2026-10-14 §2): the coach is the user's own KIP. Data only: nothing is dropped this release,
-- because older apps still read and write these fields. coachThinkingAttachment, coachThinkingText, digests,
-- recaps, conversations, memories and consents are left alone.
UPDATE "User" SET "coachPersonaId" = 'kip';

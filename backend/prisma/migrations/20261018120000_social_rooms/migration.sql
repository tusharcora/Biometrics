-- Free-build P4 (spec 2026-10-15 §10): the room-visit switch, room cheers, gifts, challenge entries and entry cheers.
ALTER TABLE "User" ADD COLUMN "shareRoom" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RoomCheer" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomCheer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "fromId" TEXT,
    "toId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChallengeEntry" (
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "circle" JSONB NOT NULL DEFAULT '[]',
    "paidAt" TIMESTAMP(3),
    "judgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeEntry_pkey" PRIMARY KEY ("userId","weekId")
);

CREATE TABLE "ChallengeCheer" (
    "weekId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeCheer_pkey" PRIMARY KEY ("weekId","fromId","toId")
);

CREATE UNIQUE INDEX "RoomCheer_fromId_toId_localDate_key" ON "RoomCheer"("fromId", "toId", "localDate");
CREATE INDEX "RoomCheer_toId_localDate_idx" ON "RoomCheer"("toId", "localDate");
CREATE INDEX "Gift_toId_openedAt_idx" ON "Gift"("toId", "openedAt");
CREATE INDEX "Gift_fromId_createdAt_idx" ON "Gift"("fromId", "createdAt");
CREATE INDEX "ChallengeEntry_weekId_idx" ON "ChallengeEntry"("weekId");
CREATE INDEX "ChallengeCheer_toId_weekId_idx" ON "ChallengeCheer"("toId", "weekId");

ALTER TABLE "RoomCheer" ADD CONSTRAINT "RoomCheer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomCheer" ADD CONSTRAINT "RoomCheer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeCheer" ADD CONSTRAINT "ChallengeCheer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeCheer" ADD CONSTRAINT "ChallengeCheer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

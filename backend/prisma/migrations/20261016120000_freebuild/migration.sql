-- KIP's free-build room (spec 2026-10-15 §2.3, §2.4, §11.1): the iso layout and the room size on the loadout row,
-- and the first-week row. `room` stays, read-only, until P2.
ALTER TABLE "CosmeticLoadout" ADD COLUMN "layout" JSONB,
ADD COLUMN "tier" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "RoomFirstWeek" (
    "userId" TEXT NOT NULL,
    "welcomedAt" TIMESTAMP(3),
    "firstPlacedAt" TIMESTAMP(3),
    "startedOn" DATE,

    CONSTRAINT "RoomFirstWeek_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "RoomFirstWeek" ADD CONSTRAINT "RoomFirstWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

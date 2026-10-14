-- KIP's room (spec 2026-10-14): earned items and the saved loadout.
CREATE TABLE "CosmeticUnlock" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "CosmeticUnlock_pkey" PRIMARY KEY ("userId","itemId")
);

CREATE TABLE "CosmeticLoadout" (
    "userId" TEXT NOT NULL,
    "room" JSONB NOT NULL,
    "worn" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CosmeticLoadout_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "CosmeticUnlock_userId_seenAt_idx" ON "CosmeticUnlock"("userId", "seenAt");

ALTER TABLE "CosmeticUnlock" ADD CONSTRAINT "CosmeticUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CosmeticLoadout" ADD CONSTRAINT "CosmeticLoadout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- KIP coins (spec 2026-10-15 §6.3) and extra copies of pieces (§2.2).
CREATE TABLE "CoinEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "capDay" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "CoinEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoinWallet" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CoinWallet_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "CoinWallet_balance_nonnegative" CHECK ("balance" >= 0)
);

CREATE TABLE "ItemGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "ItemGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoinEvent_userId_sourceKey_key" ON "CoinEvent"("userId", "sourceKey");
CREATE INDEX "CoinEvent_userId_createdAt_idx" ON "CoinEvent"("userId", "createdAt");
CREATE UNIQUE INDEX "ItemGrant_userId_sourceKey_key" ON "ItemGrant"("userId", "sourceKey");
CREATE INDEX "ItemGrant_userId_itemId_idx" ON "ItemGrant"("userId", "itemId");

ALTER TABLE "CoinEvent" ADD CONSTRAINT "CoinEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoinWallet" ADD CONSTRAINT "CoinWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemGrant" ADD CONSTRAINT "ItemGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

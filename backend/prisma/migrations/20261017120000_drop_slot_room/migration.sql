-- KIP's free-build room, P2 (spec 2026-10-15 §2.4): Spec B's slot `room` is dropped. scripts/convert-room-layouts.ts
-- runs before this migration; the guard refuses to drop the column while any row still needs it.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "CosmeticLoadout" WHERE "layout" IS NULL) > 0 THEN
    RAISE EXCEPTION 'CosmeticLoadout rows still have no layout: run scripts/convert-room-layouts.ts first';
  END IF;
END $$;

ALTER TABLE "CosmeticLoadout" DROP COLUMN "room";
ALTER TABLE "CosmeticLoadout" ALTER COLUMN "layout" SET NOT NULL;

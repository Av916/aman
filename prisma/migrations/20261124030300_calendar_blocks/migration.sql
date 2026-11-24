ALTER TABLE "Slot" ADD COLUMN "blockReason" TEXT;
ALTER TABLE "Slot" ADD CHECK ("blockReason" IS NULL OR status = 'BLOCKED') NOT VALID;

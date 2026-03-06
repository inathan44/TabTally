-- Rename description to title on Transaction table
ALTER TABLE "Transaction" RENAME COLUMN "description" TO "title";

-- Backfill NULL and empty values before adding NOT NULL constraint
UPDATE "Transaction" SET "title" = 'Untitled expense' WHERE "title" IS NULL OR "title" = '';

-- Make the column required and resize to 100 chars
ALTER TABLE "Transaction" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "Transaction" ALTER COLUMN "title" TYPE VARCHAR(100);

-- Enforce non-empty title at the database level
ALTER TABLE "Transaction" ADD CONSTRAINT transaction_title_not_empty CHECK (length(title) > 0);

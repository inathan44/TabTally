-- Convert money columns from Decimal(10,2) dollars to Int cents
-- Multiply all existing values by 100, then change column type

-- Transaction.amount: Decimal(10,2) -> Int (cents)
ALTER TABLE "Transaction" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;

-- TransactionDetail.amount: Decimal(10,2) -> Int (cents)
ALTER TABLE "TransactionDetail" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;

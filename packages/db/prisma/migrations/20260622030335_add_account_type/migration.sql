-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'ORGANIZATION';

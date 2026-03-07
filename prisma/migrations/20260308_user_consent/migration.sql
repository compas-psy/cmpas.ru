/*
  Warnings:

  - Added columns `pdnConsentVersion`, `pdnConsentHash`, `pdnConsentDate`, `adsConsentVersion`, `adsConsentHash`, `adsConsentDate` to the `User` table.
*/

-- AlterTable
ALTER TABLE "User" ADD COLUMN "pdnConsentVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "pdnConsentHash" TEXT;
ALTER TABLE "User" ADD COLUMN "pdnConsentDate" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "adsConsentVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "adsConsentHash" TEXT;
ALTER TABLE "User" ADD COLUMN "adsConsentDate" TIMESTAMP(3);

/*
  Warnings:

  - Added the required column `rendererKey` to the `Procedure` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Procedure" ADD COLUMN     "rendererKey" TEXT NOT NULL;

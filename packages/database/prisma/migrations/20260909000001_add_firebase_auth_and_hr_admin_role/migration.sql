-- AddFirebaseAuthAndHrAdminRole
-- Step 1: Add HR_ADMIN to the UserRole enum
ALTER TYPE "UserRole" ADD VALUE 'HR_ADMIN';

-- Step 2: Add Firebase / OAuth fields to users table
ALTER TABLE "users"
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "firebaseUid" TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "googleId" TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "facebookId" TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "displayName" TEXT;

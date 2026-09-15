-- CreateEnum
CREATE TYPE "AttendanceDayType" AS ENUM ('NORMAL', 'WEEKEND', 'HOLIDAY');
CREATE TYPE "TrainingScenario" AS ENUM ('CUSTOMER_COMPLAINT', 'COLLEAGUE_CONFLICT', 'MANAGER_FEEDBACK', 'NEW_EMPLOYEE_ONBOARDING', 'PERFORMANCE_REVIEW', 'GENERAL_COMMUNICATION');
CREATE TYPE "TrainingAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'GRADED');

-- AlterTable attendances
ALTER TABLE "attendances" ADD COLUMN "dayType" "AttendanceDayType" NOT NULL DEFAULT 'NORMAL';

-- CreateTable training_questions
CREATE TABLE "training_questions" (
    "id" TEXT NOT NULL,
    "scenario" "TrainingScenario" NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "question" TEXT NOT NULL,
    "optionA" TEXT,
    "optionB" TEXT,
    "optionC" TEXT,
    "optionD" TEXT,
    "correctAnswer" TEXT,
    "explanation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable training_sessions
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "scenario" "TrainingScenario" NOT NULL,
    "status" "TrainingAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "quizScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiScore" JSONB,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiFeedback" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable training_attempts
CREATE TABLE "training_attempts" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "aiEvaluation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_attempts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_attempts" ADD CONSTRAINT "training_attempts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

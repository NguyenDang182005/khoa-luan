import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { PayrollModule } from './payroll/payroll.module';
import { ContractsModule } from './contracts/contracts.module';
import { SalaryConfigModule } from './salary-config/salary-config.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AiContextModule } from './ai-context/ai-context.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AgentsModule } from './agents/agents.module';
import { TrainingModule } from './training/training.module';
import { SettingsModule } from './settings/settings.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SlackModule } from './slack/slack.module';
@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      // ../../.env = root .env của monorepo (SLACK_BOT_TOKEN, GEMINI_API_KEY, HR_API_KEY...)
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
    }),
    // Rate limiting
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),
    // Cron jobs
    ScheduleModule.forRoot(),
    // Core modules
    PrismaModule,
    AuthModule,
    UsersModule,
    EmployeesModule,
    DepartmentsModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    ContractsModule,
    // New modules
    SalaryConfigModule,
    OnboardingModule,
    AiContextModule,
    NotificationsModule,
    DashboardModule,
    AgentsModule,
    TrainingModule,
    SettingsModule,
    KnowledgeModule,
    SlackModule,
  ],
})
export class AppModule {}

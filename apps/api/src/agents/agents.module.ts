import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { PortalAgentsController } from './portal.controller';
import { AgentsService } from './agents.service';
import { AuthModule } from '../auth/auth.module';
import { AiContextModule } from '../ai-context/ai-context.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [AuthModule, AiContextModule, OnboardingModule],
  controllers: [AgentsController, PortalAgentsController],
  providers: [AgentsService],
})
export class AgentsModule {}

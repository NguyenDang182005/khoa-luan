import { Module } from '@nestjs/common';
import { AiContextController } from './ai-context.controller';
import { AiContextService, ApiKeyGuard } from './ai-context.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [AiContextController],
  providers: [AiContextService, ApiKeyGuard],
  exports: [AiContextService],
})
export class AiContextModule {}

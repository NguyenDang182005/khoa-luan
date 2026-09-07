import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import {
  NotificationsGateway,
  NotificationsService,
} from './notifications.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AiContextModule } from '../ai-context/ai-context.module';

@Module({
  imports: [PrismaModule, AiContextModule],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}

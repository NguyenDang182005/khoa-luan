import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import {
  NotificationsGateway,
  NotificationsService,
} from './notifications.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}

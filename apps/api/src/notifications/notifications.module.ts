import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import {
  NotificationsGateway,
  NotificationsService,
} from './notifications.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}

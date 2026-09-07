import { Module } from '@nestjs/common';
import { AiContextController } from './ai-context.controller';
import { AiContextService, ApiKeyGuard } from './ai-context.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiContextController],
  providers: [AiContextService, ApiKeyGuard],
  exports: [AiContextService],
})
export class AiContextModule {}

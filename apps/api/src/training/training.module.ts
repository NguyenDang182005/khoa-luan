import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';

@Module({
  imports: [ConfigModule],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}

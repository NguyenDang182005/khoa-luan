import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { PositionsController } from './positions.controller';
import { DepartmentsService } from './departments.service';

@Module({
  controllers: [DepartmentsController, PositionsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @ApiOperation({ summary: 'Danh sách hợp đồng' })
  @Get()
  findAll(@Query('employeeId') employeeId?: string) {
    return this.contractsService.findAll(employeeId);
  }

  @ApiOperation({ summary: 'Chi tiết hợp đồng' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @ApiOperation({ summary: 'Hợp đồng active của nhân viên' })
  @Get('active/:employeeId')
  getActive(@Param('employeeId') employeeId: string) {
    return this.contractsService.getActive(employeeId);
  }

  @ApiOperation({ summary: 'Tạo hợp đồng mới' })
  @Post()
  create(
    @Body()
    dto: {
      employeeId: string;
      contractNumber: string;
      type: string;
      startDate: string;
      endDate?: string;
      baseSalary: number;
      allowances?: number;
      signedDate: string;
      fileUrl?: string;
    },
  ) {
    return this.contractsService.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      signedDate: new Date(dto.signedDate),
    });
  }

  @ApiOperation({ summary: 'Cập nhật hợp đồng' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      baseSalary?: number;
      allowances?: number;
      endDate?: string;
      fileUrl?: string;
    },
  ) {
    return this.contractsService.update(id, {
      ...dto,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
  }

  @ApiOperation({ summary: 'Hủy hợp đồng' })
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.contractsService.deactivate(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { vnDateUtc } from '../common/vn-date';

@ApiTags('Contracts')
@ApiBearerAuth()
// Hợp đồng = mức lương → chỉ ADMIN. Trước đây chỉ JwtAuthGuard nên mọi token
// EMPLOYEE đọc được baseSalary của toàn công ty.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_GROUP')
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
      contractNumber?: string;
      type: string;
      startDate: string;
      endDate?: string;
      baseSalary: number;
      allowances?: number;
      signedDate?: string;
      fileUrl?: string;
    },
  ) {
    const start = vnDateUtc(new Date(dto.startDate));
    return this.contractsService.create({
      ...dto,
      startDate: start,
      endDate: dto.endDate ? vnDateUtc(new Date(dto.endDate)) : undefined,
      signedDate: dto.signedDate ? vnDateUtc(new Date(dto.signedDate)) : start,
    });
  }

  @ApiOperation({ summary: 'Cập nhật hợp đồng (loại, lương, phụ cấp, ngày, trạng thái active)' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      type?: string;
      baseSalary?: number;
      allowances?: number;
      startDate?: string;
      endDate?: string | null;
      fileUrl?: string;
      isActive?: boolean;
    },
  ) {
    return this.contractsService.update(id, {
      ...dto,
      startDate: dto.startDate ? vnDateUtc(new Date(dto.startDate)) : undefined,
      endDate:
        dto.endDate === null
          ? null
          : dto.endDate
            ? vnDateUtc(new Date(dto.endDate))
            : undefined,
    });
  }

  @ApiOperation({ summary: 'Kích hoạt hợp đồng (tự động tắt hợp đồng active khác của cùng nhân viên)' })
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.contractsService.activate(id);
  }

  @ApiOperation({ summary: 'Hủy hợp đồng' })
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.contractsService.deactivate(id);
  }
}

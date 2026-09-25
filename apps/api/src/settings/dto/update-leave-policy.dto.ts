import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** PATCH /settings/leave-policy — tất cả field đều optional (chỉ gửi field thay đổi) */
export class UpdateLeavePolicyDto {
  @ApiPropertyOptional({ example: 12, description: 'Số ngày phép chuẩn/năm' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  annualQuotaDays?: number;

  @ApiPropertyOptional({ example: 5, description: 'Cộng thêm mỗi N năm thâm niên (0 = tắt)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  seniorityBonusEveryYears?: number;

  @ApiPropertyOptional({ example: 1, description: 'Số ngày cộng tại mỗi mốc thâm niên' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  seniorityBonusDays?: number;

  @ApiPropertyOptional({ example: true, description: 'Pro-rate theo tháng vào làm năm đầu' })
  @IsOptional()
  @IsBoolean()
  prorateByJoinMonth?: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Chuyển tối đa X ngày chưa dùng sang năm sau (0 = không)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  maxCarryOverDays?: number;

  @ApiPropertyOptional({ required: false, description: 'Ghi chú chính sách' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

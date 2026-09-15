import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PiiAuditQueryDto {
  @ApiPropertyOptional({
    example: 20,
    description: 'Số message tối đa trả về (mặc định 20, tối đa 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

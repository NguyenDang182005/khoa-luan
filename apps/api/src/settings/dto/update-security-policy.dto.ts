import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/** PATCH /settings/security-policy — tất cả field đều optional */
export class UpdateSecurityPolicyDto {
  @ApiPropertyOptional({ example: 8, description: 'Độ dài mật khẩu tối thiểu' })
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(128)
  passwordMinLength?: number;

  @ApiPropertyOptional({ example: true, description: 'Bắt buộc chữ HOA' })
  @IsOptional()
  @IsBoolean()
  requireUppercase?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Bắt buộc chữ thường' })
  @IsOptional()
  @IsBoolean()
  requireLowercase?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Bắt buộc chữ số' })
  @IsOptional()
  @IsBoolean()
  requireDigit?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Bắt buộc ký tự đặc biệt' })
  @IsOptional()
  @IsBoolean()
  requireSpecial?: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Buộc đổi mật khẩu mỗi N ngày (0 = tắt)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  passwordMaxAgeDays?: number;

  @ApiPropertyOptional({ example: 5, description: 'Khóa tài khoản sau N lần sai liên tiếp' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxFailedAttempts?: number;

  @ApiPropertyOptional({ example: 15, description: 'Thời gian khóa tạm (phút)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  lockoutMinutes?: number;

  @ApiPropertyOptional({ example: 720, description: 'Thời hạn access token (giờ) — áp dụng lần đăng nhập sau' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8760)
  accessTokenTtlHours?: number;
}

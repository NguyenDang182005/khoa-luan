import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Nguyễn Văn D', description: 'Họ tên nhân viên' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'nvmoi@company.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '0907777777' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '2026-01-15', description: 'Ngày vào làm (YYYY-MM-DD)' })
  @IsDateString()
  joinDate!: string;

  @ApiProperty({ description: 'ID phòng ban' })
  @IsString()
  @IsNotEmpty()
  departmentId!: string;

  @ApiProperty({ description: 'ID chức vụ' })
  @IsString()
  @IsNotEmpty()
  positionId!: string;

  // ── Các field mở rộng (tùy chọn) ─────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'ID User liên kết. Nếu bỏ trống, hệ thống tự tạo placeholder User inactive.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Bỏ trống để tự sinh mã EMP####' })
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender?: string;

  @ApiPropertyOptional({ example: '1995-05-10' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional({ description: 'ID nhân viên quản lý trực tiếp' })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'EMPLOYEE'], description: 'Role tài khoản. Mặc định: EMPLOYEE' })
  @IsOptional()
  @IsIn(['ADMIN', 'EMPLOYEE'])
  role?: string;

  @ApiPropertyOptional({
    example: 12000000,
    description: 'Lương cơ bản — nếu truyền, tạo luôn hợp đồng thử việc để chạy được bảng lương',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @ApiPropertyOptional({ example: 1000000, description: 'Phụ cấp hàng tháng của hợp đồng' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  allowances?: number;
}

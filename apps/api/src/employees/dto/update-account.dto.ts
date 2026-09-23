import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional } from 'class-validator';

/**
 * DTO cho PATCH /employees/:id/account — "Sửa Email & Role" ở trang Quản Lý Nhân Sự.
 *
 * Email ở đây chính là WHITELIST OAuth: POST /auth/firebase tra cứu User theo
 * email từ token Google/Facebook, nên email phải hợp lệ tuyệt đối — sai định dạng
 * sẽ khiến nhân viên không thể đăng nhập bằng Google/Facebook nữa.
 */
export class UpdateAccountDto {
  @ApiPropertyOptional({
    example: 'nvmoi@gmail.com',
    description:
      'Email đăng nhập mới (whitelist OAuth Google/Facebook). Bỏ trống để giữ nguyên.',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ — cần dạng ten@domain.com' })
  email?: string;

  @ApiPropertyOptional({
    enum: ['ADMIN', 'EMPLOYEE'],
    description: 'Role tài khoản. Bỏ trống để giữ nguyên.',
  })
  @IsOptional()
  @IsIn(['ADMIN', 'EMPLOYEE'], {
    message: 'Role không hợp lệ — cho phép: ADMIN, EMPLOYEE',
  })
  role?: string;
}

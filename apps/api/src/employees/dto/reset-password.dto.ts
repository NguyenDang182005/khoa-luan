import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * DTO cho POST /employees/:id/reset-password — "Đặt Lại Mật Khẩu" ở trang Quản Lý Nhân Sự.
 *
 * - GENERATE: server sinh mật khẩu ngẫu nhiên đạt SecurityPolicy, trả plaintext ĐÚNG 1 LẦN
 *   (hệ thống không có email nên admin phải chuyển tay cho nhân viên).
 * - MANUAL: admin tự nhập newPassword — service sẽ kiểm tra theo SecurityPolicy hiện hành.
 *
 * Việc validate độ mạnh chi tiết nằm ở service (chính sách đọc từ DB, không hardcode ở DTO).
 */
export class ResetPasswordDto {
  @ApiProperty({
    enum: ['GENERATE', 'MANUAL'],
    description: 'GENERATE: server sinh mật khẩu random. MANUAL: dùng newPassword do admin nhập.',
  })
  @IsIn(['GENERATE', 'MANUAL'], { message: 'Mode không hợp lệ — cho phép: GENERATE, MANUAL' })
  mode!: 'GENERATE' | 'MANUAL';

  @ApiPropertyOptional({
    example: 'MatKhau@123',
    description: 'Bắt buộc khi mode=MANUAL. Sẽ được kiểm tra theo SecurityPolicy (độ dài, chữ hoa/thường, số, ký tự đặc biệt).',
  })
  @IsOptional()
  @IsString({ message: 'Mật khẩu mới phải là chuỗi ký tự' })
  newPassword?: string;
}

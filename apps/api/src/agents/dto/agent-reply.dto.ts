import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AgentReplyDto {
  @ApiProperty({
    example: 'Chào anh, bộ phận CSKH đã nhận được khiếu nại...',
    description: 'Nội dung phản hồi của nhân viên (human takeover)',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

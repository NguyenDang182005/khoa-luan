import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AgentChatDto {
  @ApiProperty({
    example: 'Lương tháng 8/2026 của tôi là bao nhiêu?',
    description: 'Câu hỏi của nhân viên gửi tới AI Agent',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}

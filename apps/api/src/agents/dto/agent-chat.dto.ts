import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AgentChatDto {
  @ApiProperty({
    example: 'Lương tháng 8/2026 của tôi là bao nhiêu?',
    description: 'Câu hỏi của nhân viên gửi tới AI Agent',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiProperty({
    required: false,
    description: 'Q16-session: phiên chat đang dùng (backend xác minh quyền sở hữu)',
  })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({
    required: false,
    enum: ['HR_QA', 'TRAINING', 'OTHER'],
    description: 'Loại phiên cần khi chưa có sessionId (mặc định OTHER)',
  })
  @IsIn(['HR_QA', 'TRAINING', 'OTHER'])
  @IsOptional()
  sessionType?: string;

  @ApiProperty({
    required: false,
    description: 'WF03: kịch bản huấn luyện (customer_complaint | colleague_conflict | manager_feedback | new_employee_onboarding | performance_review | general_communication)',
  })
  @IsString()
  @IsOptional()
  scenarioType?: string;
}

export class SessionTypeDto {
  @ApiProperty({ enum: ['HR_QA', 'TRAINING', 'OTHER'] })
  @IsIn(['HR_QA', 'TRAINING', 'OTHER'])
  type!: string;
}

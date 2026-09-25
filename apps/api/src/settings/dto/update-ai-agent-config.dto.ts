import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** PATCH /settings/ai-config
 *  - webhookUrl: chuỗi rỗng = xóa (fallback env)
 *  - apiKey: undefined = giữ nguyên; chuỗi mới = đặt lại; rỗng/null = xóa (fallback env) */
export class UpdateAiAgentConfigDto {
  @ApiPropertyOptional({ example: true, description: 'Bật/tắt AI Agent toàn hệ thống' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ required: false, description: 'URL webhook n8n (trống = dùng env N8N_WEBHOOK_URL)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  webhookUrl?: string | null;

  @ApiPropertyOptional({ required: false, description: 'API key mới (write-only — GET chỉ trả apiKeySet)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiKey?: string | null;

  @ApiPropertyOptional({ example: 90000, description: 'Timeout mỗi lần gọi n8n (ms)' })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300000)
  timeoutMs?: number;
}

import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiKeyGuard } from '../ai-context/ai-context.service';
import { KnowledgeService } from './knowledge.service';

class KnowledgeSearchDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  topK?: number;
}

@ApiTags('Knowledge Base (n8n) — RAG')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('n8n')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @ApiOperation({
    summary: 'RAG: tìm chunk chính sách nhân sự liên quan theo độ tương đồng ngữ nghĩa',
  })
  @Get('knowledge-search')
  searchGet(
    @Query('query') query: string,
    @Query('topK') topK?: string,
  ) {
    return this.knowledge.search(query ?? '', Number(topK) || 4);
  }

  @ApiOperation({ summary: 'RAG: tìm chunk chính sách (POST variant)' })
  @Post('knowledge-search')
  searchPost(@Body() dto: KnowledgeSearchDto) {
    return this.knowledge.search(dto.query ?? '', Number(dto.topK) || 4);
  }
}

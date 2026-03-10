import { IsOptional, IsString, IsIn } from 'class-validator'

export class QueryVideoTaskDto {
  @IsOptional()
  @IsIn(['sora', 'veo', 'grok', 'doubao', 'kling'])
  platform?: 'sora' | 'veo' | 'grok' | 'doubao' | 'kling'

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  page?: string

  @IsOptional()
  @IsString()
  limit?: string
}

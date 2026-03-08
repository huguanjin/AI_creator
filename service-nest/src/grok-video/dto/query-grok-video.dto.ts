import { IsString, IsOptional, IsIn } from 'class-validator'

/**
 * 查询 Grok 视频任务 DTO
 * GET /v1/grok/query?id=xxx&channel=aifast
 */
export class QueryGrokVideoDto {
  @IsString()
  id: string

  /**
   * 接口渠道
   * aifast: 默认渠道 (GET /v1/videos/{id})
   * xiaohumini: xiaohumini站 (GET /v1/video/query?id=xxx)
   */
  @IsOptional()
  @IsString()
  @IsIn(['aifast', 'xiaohumini'])
  channel?: string
}

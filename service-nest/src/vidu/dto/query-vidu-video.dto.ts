import { IsString, IsOptional, IsIn } from 'class-validator'

/**
 * 查询 Vidu 视频任务 DTO
 * GET /v1/vidu/query?id=xxx&channel=aifast
 */
export class QueryViduVideoDto {
  @IsString()
  id: string

  /**
   * 接口渠道
   * default: 测试接口官转接口1
   * aifast: AIFAST站接口
   */
  @IsOptional()
  @IsString()
  @IsIn(['default', 'aifast'])
  channel?: string
}

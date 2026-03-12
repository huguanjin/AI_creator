import { IsString } from 'class-validator'

/**
 * 查询 Vidu 视频任务 DTO
 * GET /v1/vidu/query?id=xxx
 */
export class QueryViduVideoDto {
  @IsString()
  id: string
}

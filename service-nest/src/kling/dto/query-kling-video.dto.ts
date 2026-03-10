import { IsString, IsNotEmpty } from 'class-validator'

/**
 * 查询可灵视频任务 DTO
 * GET /v1/kling/query?id=xxx
 * 对应 aifast 网关: GET /v1/videos/{task_id}
 */
export class QueryKlingVideoDto {
  @IsString()
  @IsNotEmpty()
  id: string
}

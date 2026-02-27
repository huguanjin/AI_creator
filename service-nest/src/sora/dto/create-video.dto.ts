import { IsNumber, IsOptional, IsString } from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * 创建 Sora 视频 DTO
 * POST /v1/video/create → upstream POST /v1/videos (multipart/form-data)
 *
 * 上游 API 字段：
 *  - model (required): 模型名称，如 sora-2
 *  - prompt (required): 提示词
 *  - size: 分辨率，720x1280 或 1280x720
 *  - seconds: 秒数，支持 10 和 15
 *  - input_reference: 参考图 (文件上传，Controller 层处理)
 *  - character_url: 角色视频链接
 *  - character_timestamps: 角色出现秒数范围，如 "1,3"
 */
export class CreateVideoDto {
  /**
   * 模型名称
   * sora-2 等
   */
  @IsString()
  model: string

  /**
   * 提示词
   */
  @IsString()
  prompt: string

  /**
   * 视频尺寸 (分辨率)
   * 720x1280 - 竖屏
   * 1280x720 - 横屏
   */
  @IsOptional()
  @IsString()
  size?: string

  /**
   * 视频时长（秒）
   * 支持 10, 15
   */
  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : undefined)
  @IsNumber()
  seconds?: number

  /**
   * 角色视频链接
   * 用于创建角色，视频中不能出现真人
   */
  @IsOptional()
  @IsString()
  character_url?: string

  /**
   * 角色出现的秒数范围
   * 格式: "start,end"，如 "1,3"，end-start 范围 1~3 秒
   */
  @IsOptional()
  @IsString()
  character_timestamps?: string
}

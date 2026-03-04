import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * 创建 Grok 视频 DTO
 * POST /v1/grok/create
 * 对应 API: POST /v1/videos (multipart/form-data)
 */
export class CreateGrokVideoDto {
  /**
   * 模型名称
   * grok-video-3 (6秒视频)
   * grok-video-3-max (15秒视频)
   * grok-video-pro (10秒视频)
   */
  @IsString()
  model: string

  /**
   * 提示词
   */
  @IsString()
  prompt: string

  /**
   * 尺寸比例
   * 可选: 2:3, 3:2, 1:1
   */
  @IsOptional()
  @IsString()
  @IsIn(['2:3', '3:2', '1:1'])
  aspect_ratio?: string

  /**
   * 视频秒数
   * grok-video-3 固定 6 秒
   * grok-video-3-max 固定 15 秒
   * grok-video-pro 固定 10 秒
   */
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  seconds?: number

  /**
   * 分辨率
   * 720P 或 1080P
   */
  @IsOptional()
  @IsString()
  @IsIn(['720P', '1080P'])
  size?: string
}

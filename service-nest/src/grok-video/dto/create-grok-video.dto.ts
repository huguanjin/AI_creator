import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * 创建 Grok 视频 DTO
 * POST /v1/grok/create
 * 对应 API:
 *   aifast 渠道: POST /v1/videos (multipart/form-data)
 *   xiaohumini 渠道: POST /v1/video/create (JSON)
 */
export class CreateGrokVideoDto {
  /**
   * 接口渠道
   * aifast: 默认渠道
   * xiaohumini: xiaohumini站接口
   */
  @IsOptional()
  @IsString()
  @IsIn(['aifast', 'xiaohumini'])
  channel?: string

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

  /**
   * 图片URL列表 (xiaohumini 渠道使用，JSON字符串)
   */
  @IsOptional()
  @IsString()
  images?: string
}

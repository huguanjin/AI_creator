import { IsOptional, IsString } from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * 创建可灵视频 DTO
 * POST /v1/kling/create
 * 对应 aifast 网关: POST /v1/videos (JSON)
 *
 * 支持场景：
 *  - 文生视频 (纯 prompt)
 *  - 图生视频 (image/images)
 *  - 首尾帧 (image + metadata.last_frame_url)
 *  - 动作控制 (metadata.scene_type=motion_control + metadata.video_url)
 *  - 数字人 (metadata.scene_type=avatar_i2v)
 *  - 对口型 (metadata.scene_type=lip_sync)
 */
export class CreateKlingVideoDto {
  /**
   * 模型名称
   * 基础模型: Kling-1.6, Kling-2.0, Kling-2.1, Kling-2.5, Kling-2.6, Kling-3.0, Kling-3.0-Omni, Kling-O1
   * 组合计费模型: kling-3.0-omni-1080p-ref-audio, kling-2.6-motion-pro-1080p 等
   */
  @IsString()
  model: string

  /**
   * 提示词
   */
  @IsString()
  prompt: string

  /**
   * 视频时长（秒）
   */
  @IsOptional()
  @IsString()
  seconds?: string

  /**
   * 分辨率: 720p, 1080P 等
   */
  @IsOptional()
  @IsString()
  size?: string

  /**
   * 单张参考图 URL（图生视频）
   */
  @IsOptional()
  @IsString()
  image?: string

  /**
   * 多张参考图 URL (JSON 数组字符串)
   */
  @IsOptional()
  @IsString()
  images?: string

  /**
   * 扩展参数 (JSON 字符串)
   * 支持字段：
   *  - scene_type: motion_control / avatar_i2v / lip_sync / template_effect
   *  - motion_level: std / pro (动作控制档位)
   *  - offpeak: boolean (错峰计费)
   *  - last_frame_url: string (尾帧 URL)
   *  - video_url: string (参考视频 URL)
   *  - output_config: { resolution, aspect_ratio, audio_generation, ... }
   *  - file_infos: array (腾讯原生 FileInfos 透传)
   */
  @IsOptional()
  @IsString()
  metadata?: string
}

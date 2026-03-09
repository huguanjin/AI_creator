import { IsOptional, IsString, IsIn } from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * 创建豆包视频 DTO
 * 支持两个渠道：
 *   aifast 渠道: POST /v1/videos (multipart/form-data)
 *   xiaohumini 渠道: POST /volc/v1/contents/generations/tasks (JSON)
 *
 * 通用字段：
 *  - model (required): 模型名称
 *  - prompt (required): 提示词
 *  - channel: 接口渠道 (aifast | xiaohumini)
 *
 * aifast 渠道字段：
 *  - size: 宽高比，16:9 / 4:3 / 1:1 / 3:4 / 9:16 / 21:9 / keep_ratio / adaptive
 *  - seconds: 秒数 (4~12)
 *  - first_frame_image / last_frame_image: 首帧/尾帧图片 (文件上传)
 *
 * xiaohumini 渠道字段：
 *  - resolution: 视频分辨率 (480p / 720p / 1080p)
 *  - size: 宽高比 (复用，作为 --ratio)
 *  - seconds: 时长 (复用，作为 --duration)
 *  - camera_fixed: 固定摄像头 ('true' / 'false')
 *  - watermark: 水印 ('true' / 'false')
 *  - seed: 种子值
 *  - generate_audio: 生成音频 ('true' / 'false'，仅 Seedance 1.5 pro)
 *  - images: 参考图 URL JSON 数组
 */
export class CreateDoubaoVideoDto {
  @IsOptional()
  @IsString()
  @IsIn(['aifast', 'xiaohumini'])
  channel?: string

  @IsString()
  model: string

  @IsString()
  prompt: string

  @IsOptional()
  @IsString()
  size?: string

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  seconds?: number

  // xiaohumini 渠道参数
  @IsOptional()
  @IsString()
  resolution?: string

  @IsOptional()
  @IsString()
  camera_fixed?: string

  @IsOptional()
  @IsString()
  watermark?: string

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined))
  seed?: number

  @IsOptional()
  @IsString()
  generate_audio?: string

  @IsOptional()
  @IsString()
  images?: string
}

import { IsOptional, IsString, IsIn, IsNumber } from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * 创建豆包视频 DTO
 * 支持三个渠道：
 *   aifast 渠道: POST /v1/videos (multipart/form-data)
 *   xiaohumini 渠道: POST /volc/v1/contents/generations/tasks (JSON)
 *   seedance2 渠道: POST /v1/videos (JSON，OpenAI 兼容格式)
 *
 * 通用字段：
 *  - model (required): 模型名称
 *  - prompt (required): 提示词
 *  - channel: 接口渠道 (aifast | xiaohumini | seedance2)
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
 *
 * seedance2 渠道字段 (Seedance 2.0 系列，OpenAI 兼容 JSON 格式)：
 *  - image: 参考图片 URL 或 Base64（图生视频时使用）
 *  - duration: 视频时长（秒），如 5、10
 *  - width: 视频宽度（像素）
 *  - height: 视频高度（像素）
 *  - fps: 帧率
 *  - seed: 随机种子（复用）
 *  - n: 生成数量，默认 1
 *  - metadata: 扩展参数，透传至上游
 */
export class CreateDoubaoVideoDto {
  @IsOptional()
  @IsString()
  @IsIn(['aifast', 'xiaohumini', 'seedance2'])
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

  // seedance2 渠道参数 (Seedance 2.0 系列)
  @IsOptional()
  @IsString()
  image?: string

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  duration?: number

  @IsOptional()
  @IsString()
  seedance2Resolution?: string

  @IsOptional()
  @IsString()
  ratio?: string

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  width?: number

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  height?: number

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  fps?: number

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  n?: number

  @IsOptional()
  @IsString()
  metadata?: string
}

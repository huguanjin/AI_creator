import { IsOptional, IsString } from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * 创建豆包视频 DTO
 * 上游 API: POST /v1/videos (multipart/form-data)
 *
 * 字段说明：
 *  - model (required): 模型名称，如 doubao-seedance-1-5-pro_720p
 *  - prompt (required): 提示词
 *  - size: 宽高比，16:9 / 4:3 / 1:1 / 3:4 / 9:16 / 21:9 / keep_ratio / adaptive
 *  - seconds: 秒数 (4~12)
 *  - first_frame_image: 首帧图片 (文件上传，Controller 层处理)
 *  - last_frame_image: 尾帧图片 (文件上传，Controller 层处理)
 */
export class CreateDoubaoVideoDto {
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
}

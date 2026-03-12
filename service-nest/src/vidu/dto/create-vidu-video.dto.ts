import { IsString, IsOptional, IsNumber, IsIn, IsArray, IsBoolean } from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * 创建 Vidu 视频 DTO
 * POST /v1/vidu/create
 * 支持两个渠道:
 *   default (测试接口官转接口1): 使用内部 API 路径
 *   aifast (AIFAST站): 使用 OpenAI Video 格式 /v1/video/generations
 * 支持四种任务类型:
 *   文生视频: text2video / textGenerate
 *   图生视频: img2video / generate
 *   参考生视频: reference2video / referenceGenerate
 *   首尾帧: start-end2video / firstTailGenerate
 */
export class CreateViduVideoDto {
  /**
   * 接口渠道
   * default: 测试接口官转接口1（原有渠道）
   * aifast: AIFAST站接口
   */
  @IsOptional()
  @IsString()
  @IsIn(['default', 'aifast'])
  channel?: string

  /**
   * 任务类型
   * text2video: 文生视频
   * img2video: 图生视频
   * reference2video: 参考生视频
   * start-end2video: 首尾帧生视频
   */
  @IsOptional()
  @IsString()
  @IsIn(['text2video', 'img2video', 'reference2video', 'start-end2video'])
  task_type?: string

  /**
   * 模型名称
   * 文生视频: TC-vidu-q2, TC-vidu-q3-pro, TC-vidu-q3-turbo
   * 图生视频: TC-vidu-q2-pro, TC-vidu-q3-pro, TC-vidu-q3-turbo
   * 首尾帧: TC-vidu-q2-pro, TC-vidu-q2-turbo, TC-vidu-q3-turbo
   * 参考生视频: TC-vidu-q2
   */
  @IsString()
  model: string

  /**
   * 提示词
   */
  @IsString()
  prompt: string

  /**
   * 视频时长(秒), 默认5s, 支持1-10s
   */
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  duration?: number

  /**
   * 尺寸比例
   * 默认 16:9, 可选: 16:9, 9:16, 3:4, 4:3, 1:1
   * 注: 3:4, 4:3 仅支持 q2 模型
   */
  @IsOptional()
  @IsString()
  @IsIn(['16:9', '9:16', '3:4', '4:3', '1:1'])
  aspect_ratio?: string

  /**
   * 分辨率, 默认720p
   */
  @IsOptional()
  @IsString()
  resolution?: string

  /**
   * 图片URL列表 (图生视频/首尾帧使用, JSON字符串)
   * 图生视频: 仅支持1张
   * 首尾帧: 强制2张, 第一张=首帧, 第二张=尾帧
   */
  @IsOptional()
  @IsString()
  images?: string

  /**
   * 参考生视频的主体信息 (JSON字符串)
   * [{images: [...], id: "1"}, ...]
   */
  @IsOptional()
  @IsString()
  subjects?: string

  /**
   * 是否错峰模式
   */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  off_peak?: boolean
}

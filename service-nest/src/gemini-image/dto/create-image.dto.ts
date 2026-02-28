import { IsArray, IsIn, IsNumber, IsOptional, IsString } from 'class-validator'

/**
 * 创建图片 DTO
 * POST /v1/image/create
 */
export class CreateImageDto {
  /**
   * 模型名称
   * Gemini: gemini-3-pro-image-preview, gemini-3.1-flash-image-preview, gemini-2.0-flash-exp-image-generation
   * Grok: grok-4-1-image
   * GPT: gpt-image-1.5
   */
  @IsOptional()
  @IsString()
  model?: string

  /**
   * 提示词
   */
  @IsString()
  prompt: string

  /**
   * 宽高比（Gemini 模型使用）
   * 通用: 1:1, 16:9, 9:16, 4:3, 3:4
   * gemini-3.1-flash-image-preview 额外支持: 1:4, 4:1, 1:8, 8:1
   */
  @IsOptional()
  @IsString()
  aspectRatio?: string

  /**
   * 图片尺寸/清晰度（Gemini 模型使用）
   * 通用: 1K, 2K, 4K
   * gemini-3.1-flash-image-preview 额外支持: 0.5K (512px)
   */
  @IsOptional()
  @IsString()
  imageSize?: string

  /**
   * 图片尺寸（Grok/GPT 模型使用）
   * 支持: 1024x1024, 1536x1024, 1024x1536, 或 1:1, 2:3, 3:2
   */
  @IsOptional()
  @IsString()
  size?: string

  /**
   * 图片数量（Grok/GPT 模型使用）
   * 默认: 1
   */
  @IsOptional()
  @IsNumber()
  n?: number

  /**
   * 参考图片（Base64 编码）
   * 用于图片编辑/修改
   * gemini-3.1-flash-image-preview 最多 14 张，其他模型最多 5 张
   */
  @IsOptional()
  @IsArray()
  referenceImages?: Array<{
    mimeType: string
    data: string
  }>
}

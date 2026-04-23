import { IsArray, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

export class StartStressTestDto {
  /** 模型名称 */
  @IsString()
  model!: string

  /** API 渠道（Grok/GPT 模型使用） */
  @IsOptional()
  @IsString()
  @IsIn(['aifast', 'xiaohumini'])
  channel?: string

  /** 每分钟请求数 */
  @IsNumber()
  @Min(1)
  @Max(600)
  rpm!: number

  /** 总请求数（为空时持续运行直到手动停止） */
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalRequests?: number

  /** 提示词列表，循环使用 */
  @IsArray()
  @IsString({ each: true })
  prompts!: string[]

  /** 画面比例（Gemini 模型） */
  @IsOptional()
  @IsString()
  aspectRatio?: string

  /** 图片尺寸（Gemini 模型） */
  @IsOptional()
  @IsString()
  imageSize?: string

  /** 图片尺寸（Grok/GPT 模型） */
  @IsOptional()
  @IsString()
  size?: string

  /** 图片数量（Grok/GPT 模型） */
  @IsOptional()
  @IsNumber()
  n?: number
}

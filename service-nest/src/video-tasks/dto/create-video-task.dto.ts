export class CreateVideoTaskDto {
  /** 外部任务 ID（从 API 返回的 ID） */
  externalTaskId: string

  /** 平台: sora / veo / grok / doubao / kling / vidu */
  platform: 'sora' | 'veo' | 'grok' | 'doubao' | 'kling' | 'vidu'

  /** 使用的模型 */
  model: string

  /** 生成提示词 */
  prompt: string

  /** 创建时的请求参数快照 */
  params?: Record<string, any>

  /** API 创建返回的原始响应 */
  apiResponse?: Record<string, any>
}

export class CreateModelCatalogDto {
  /** 平台: sora / veo / grok / doubao / kling */
  platform: string

  /** 分类名称，如 "标准版"、"高级版"、"aifast 接口" */
  category: string

  /** 显示名称 */
  name: string

  /** 模型值（提交给 API 的实际值） */
  value: string

  /** 排序（越小越靠前） */
  sort?: number

  /** 是否启用 */
  enabled?: boolean
}

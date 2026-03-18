import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { CreatePromptTemplateDto } from './create-prompt-template.dto'
import { UpdatePromptTemplateDto } from './update-prompt-template.dto'
import { ObjectId } from 'mongodb'

export interface PromptTemplateDocument {
  _id?: any
  name: string
  content: string
  category: string
  sort: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

@Injectable()
export class PromptTemplateService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PromptTemplateService.name)
  private readonly COLLECTION = 'prompt_templates'

  constructor(private readonly databaseService: DatabaseService) {}

  async onApplicationBootstrap() {
    await this.ensureIndexes()
    this.logger.log('✅ PromptTemplateService initialized')
  }

  private async ensureIndexes() {
    try {
      const col = this.databaseService.getCollection(this.COLLECTION)
      await col.createIndex({ category: 1, sort: 1 })
      await col.createIndex({ enabled: 1 })
      this.logger.log('📇 prompt_templates indexes ensured')
    } catch (error) {
      this.logger.warn(`⚠️ prompt_templates index warning: ${error.message}`)
    }
  }

  /**
   * 创建提示词模板
   */
  async create(dto: CreatePromptTemplateDto): Promise<PromptTemplateDocument> {
    const now = Date.now()
    const doc: PromptTemplateDocument = {
      name: dto.name,
      content: dto.content,
      category: dto.category || '默认',
      sort: dto.sort ?? 0,
      enabled: dto.enabled !== false,
      createdAt: now,
      updatedAt: now,
    }

    const col = this.databaseService.getCollection(this.COLLECTION)
    const result = await col.insertOne(doc as any)
    doc._id = result.insertedId
    this.logger.log(`📝 PromptTemplate created: ${dto.name}`)
    return doc
  }

  /**
   * 更新提示词模板
   */
  async update(id: string, dto: UpdatePromptTemplateDto): Promise<PromptTemplateDocument | null> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const updates: Record<string, any> = { updatedAt: Date.now() }
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.content !== undefined) updates.content = dto.content
    if (dto.category !== undefined) updates.category = dto.category
    if (dto.sort !== undefined) updates.sort = dto.sort
    if (dto.enabled !== undefined) updates.enabled = dto.enabled

    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: 'after' },
    )
    return result as unknown as PromptTemplateDocument | null
  }

  /**
   * 删除提示词模板
   */
  async delete(id: string): Promise<boolean> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const result = await col.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount > 0
  }

  /**
   * 切换启用/禁用
   */
  async toggleEnabled(id: string): Promise<PromptTemplateDocument | null> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const doc = await col.findOne({ _id: new ObjectId(id) })
    if (!doc) return null

    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { enabled: !(doc as any).enabled, updatedAt: Date.now() } },
      { returnDocument: 'after' },
    )
    return result as unknown as PromptTemplateDocument | null
  }

  /**
   * 获取已启用的模板列表（用户使用）
   */
  async getEnabled(): Promise<PromptTemplateDocument[]> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const docs = await col
      .find({ enabled: true })
      .sort({ category: 1, sort: 1 })
      .toArray()
    return docs as unknown as PromptTemplateDocument[]
  }

  /**
   * 获取所有模板（管理员使用）
   */
  async getAll(): Promise<PromptTemplateDocument[]> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const docs = await col.find({}).sort({ category: 1, sort: 1 }).toArray()
    return docs as unknown as PromptTemplateDocument[]
  }

  /**
   * 根据ID获取单个模板
   */
  async getById(id: string): Promise<PromptTemplateDocument | null> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const doc = await col.findOne({ _id: new ObjectId(id) })
    return doc as unknown as PromptTemplateDocument | null
  }
}

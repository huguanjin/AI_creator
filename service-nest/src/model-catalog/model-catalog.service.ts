import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { CreateModelCatalogDto } from './dto/create-model-catalog.dto'
import { UpdateModelCatalogDto } from './dto/update-model-catalog.dto'
import { ObjectId } from 'mongodb'

export interface ModelCatalogDocument {
  _id?: any
  platform: string
  category: string
  name: string
  value: string
  sort: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

@Injectable()
export class ModelCatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ModelCatalogService.name)
  private readonly COLLECTION = 'model_catalogs'

  constructor(private readonly databaseService: DatabaseService) {}

  async onApplicationBootstrap() {
    await this.ensureIndexes()
    this.logger.log('✅ ModelCatalogService initialized')
  }

  private async ensureIndexes() {
    try {
      const col = this.databaseService.getCollection(this.COLLECTION)
      await col.createIndex({ platform: 1, category: 1, sort: 1 })
      await col.createIndex({ platform: 1, enabled: 1 })
      await col.createIndex({ platform: 1, value: 1 }, { unique: true })
      this.logger.log('📇 model_catalogs indexes ensured')
    } catch (error) {
      this.logger.warn(`⚠️ model_catalogs index warning: ${error.message}`)
    }
  }

  /**
   * 创建模型记录
   */
  async create(dto: CreateModelCatalogDto): Promise<ModelCatalogDocument> {
    const now = Date.now()
    const doc: ModelCatalogDocument = {
      platform: dto.platform,
      category: dto.category,
      name: dto.name,
      value: dto.value,
      sort: dto.sort ?? 0,
      enabled: dto.enabled !== false,
      createdAt: now,
      updatedAt: now,
    }

    const col = this.databaseService.getCollection(this.COLLECTION)
    const result = await col.insertOne(doc as any)
    doc._id = result.insertedId
    this.logger.log(`📝 Model created: ${dto.platform}/${dto.value}`)
    return doc
  }

  /**
   * 更新模型记录
   */
  async update(id: string, dto: UpdateModelCatalogDto): Promise<ModelCatalogDocument | null> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const updates: Record<string, any> = { updatedAt: Date.now() }
    if (dto.platform !== undefined) updates.platform = dto.platform
    if (dto.category !== undefined) updates.category = dto.category
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.value !== undefined) updates.value = dto.value
    if (dto.sort !== undefined) updates.sort = dto.sort
    if (dto.enabled !== undefined) updates.enabled = dto.enabled

    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: 'after' },
    )
    return result as unknown as ModelCatalogDocument | null
  }

  /**
   * 删除模型记录
   */
  async delete(id: string): Promise<boolean> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const result = await col.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount > 0
  }

  /**
   * 切换启用/禁用
   */
  async toggleEnabled(id: string): Promise<ModelCatalogDocument | null> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const doc = await col.findOne({ _id: new ObjectId(id) })
    if (!doc) return null

    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { enabled: !(doc as any).enabled, updatedAt: Date.now() } },
      { returnDocument: 'after' },
    )
    return result as unknown as ModelCatalogDocument | null
  }

  /**
   * 获取指定平台的已启用模型（按 category + sort 分组排序，前端下拉菜单使用）
   */
  async getByPlatform(platform: string): Promise<ModelCatalogDocument[]> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const docs = await col
      .find({ platform, enabled: true })
      .sort({ category: 1, sort: 1 })
      .toArray()
    return docs as unknown as ModelCatalogDocument[]
  }

  /**
   * 获取所有模型（管理员使用，包含禁用的）
   */
  async getAll(platform?: string): Promise<ModelCatalogDocument[]> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const filter: Record<string, any> = {}
    if (platform) filter.platform = platform
    const docs = await col.find(filter).sort({ platform: 1, category: 1, sort: 1 }).toArray()
    return docs as unknown as ModelCatalogDocument[]
  }

  /**
   * 批量导入默认模型（仅当集合为空时执行）
   */
  async seedDefaults(): Promise<{ inserted: number }> {
    const col = this.databaseService.getCollection(this.COLLECTION)
    const count = await col.countDocuments()
    if (count > 0) {
      this.logger.log('📦 model_catalogs already has data, skip seeding')
      return { inserted: 0 }
    }

    const now = Date.now()
    const defaults: Omit<ModelCatalogDocument, '_id'>[] = [
      // === Sora ===
      { platform: 'sora', category: '标准版', name: 'sora-2', value: 'sora-2', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'sora', category: '标准版', name: 'sora-2-pro', value: 'sora-2-pro', sort: 2, enabled: true, createdAt: now, updatedAt: now },

      // === VEO ===
      { platform: 'veo', category: '✨ 高质量版本', name: 'veo_3_1', value: 'veo_3_1', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'veo', category: '✨ 高质量版本', name: 'veo_3_1-4K', value: 'veo_3_1-4K', sort: 2, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'veo', category: '⚡ 快速版本', name: 'veo_3_1-fast', value: 'veo_3_1-fast', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'veo', category: '⚡ 快速版本', name: 'veo_3_1-fast-4K', value: 'veo_3_1-fast-4K', sort: 2, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'veo', category: '🎨 仅参考图版本', name: 'veo_3_1-components', value: 'veo_3_1-components', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'veo', category: '🎨 仅参考图版本', name: 'veo_3_1-components-4K', value: 'veo_3_1-components-4K', sort: 2, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'veo', category: '🎨 仅参考图版本', name: 'veo_3_1-fast-components', value: 'veo_3_1-fast-components', sort: 3, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'veo', category: '🎨 仅参考图版本', name: 'veo_3_1-fast-components-4K', value: 'veo_3_1-fast-components-4K', sort: 4, enabled: true, createdAt: now, updatedAt: now },

      // === Grok ===
      { platform: 'grok', category: 'aifast 接口', name: 'grok-video-3 (6秒)', value: 'grok-video-3', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'grok', category: 'aifast 接口', name: 'grok-video-3-max (15秒)', value: 'grok-video-3-max', sort: 2, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'grok', category: 'aifast 接口', name: 'grok-video-pro (10秒)', value: 'grok-video-pro', sort: 3, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'grok', category: 'xiaohumini站 接口', name: 'grok-video-3-10s (10秒)', value: 'grok-video-3-10s', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'grok', category: 'xiaohumini站 接口', name: 'grok-video-3-15s (15秒)', value: 'grok-video-3-15s', sort: 2, enabled: true, createdAt: now, updatedAt: now },

      // === 豆包 Doubao - aifast ===
      { platform: 'doubao', category: '🎬 标准版 (aifast)', name: 'doubao-seedance-1-5-pro_480p', value: 'doubao-seedance-1-5-pro_480p', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'doubao', category: '🎬 标准版 (aifast)', name: 'doubao-seedance-1-5-pro_720p', value: 'doubao-seedance-1-5-pro_720p', sort: 2, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'doubao', category: '🎬 标准版 (aifast)', name: 'doubao-seedance-1-5-pro_1080p', value: 'doubao-seedance-1-5-pro_1080p', sort: 3, enabled: true, createdAt: now, updatedAt: now },
      // === 豆包 Doubao - xiaohumini ===
      { platform: 'doubao', category: '🎬 Seedance 1.5 Pro (xiaohumini)', name: 'doubao-seedance-1-5-pro-251215 (文生/首帧/首尾帧)', value: 'doubao-seedance-1-5-pro-251215', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'doubao', category: '⚡ Seedance 1.0 Pro (xiaohumini)', name: 'doubao-seedance-1-0-pro-250528 (文生/首帧/首尾帧)', value: 'doubao-seedance-1-0-pro-250528', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'doubao', category: '⚡ Seedance 1.0 Pro (xiaohumini)', name: 'doubao-seedance-1-0-pro-fast-251015 (文生/首帧)', value: 'doubao-seedance-1-0-pro-fast-251015', sort: 2, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'doubao', category: '🎨 Seedance 1.0 Lite (xiaohumini)', name: 'doubao-seedance-1-0-lite-t2v-250428 (文生)', value: 'doubao-seedance-1-0-lite-t2v-250428', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'doubao', category: '🎨 Seedance 1.0 Lite (xiaohumini)', name: 'doubao-seedance-1-0-lite-i2v-250428 (首帧/首尾帧/参考图)', value: 'doubao-seedance-1-0-lite-i2v-250428', sort: 2, enabled: true, createdAt: now, updatedAt: now },

      // === 可灵 Kling ===
      { platform: 'kling', category: '🎬 标准版', name: 'Kling-1.6', value: 'Kling-1.6', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'kling', category: '🎬 标准版', name: 'Kling-2.0', value: 'Kling-2.0', sort: 2, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'kling', category: '🎬 标准版', name: 'Kling-2.1', value: 'Kling-2.1', sort: 3, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'kling', category: '🎬 标准版', name: 'Kling-2.5', value: 'Kling-2.5', sort: 4, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'kling', category: '🎬 标准版', name: 'Kling-2.6', value: 'Kling-2.6', sort: 5, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'kling', category: '🎬 标准版', name: 'Kling-3.0', value: 'Kling-3.0', sort: 6, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'kling', category: '✨ 高级版', name: 'Kling-3.0-Omni', value: 'Kling-3.0-Omni', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'kling', category: '✨ 高级版', name: 'Kling-O1', value: 'Kling-O1', sort: 2, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'kling', category: '📦 按量计费组合', name: 'kling-3.0-omni-1080p-ref-audio', value: 'kling-3.0-omni-1080p-ref-audio', sort: 1, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'kling', category: '📦 按量计费组合', name: 'kling-2.6-motion-pro-1080p', value: 'kling-2.6-motion-pro-1080p', sort: 2, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'kling', category: '📦 按量计费组合', name: 'kling-avatar-720p', value: 'kling-avatar-720p', sort: 3, enabled: true, createdAt: now, updatedAt: now },
      { platform: 'kling', category: '📦 按量计费组合', name: 'kling-identify-face', value: 'kling-identify-face', sort: 4, enabled: true, createdAt: now, updatedAt: now },
    ]

    await col.insertMany(defaults as any[])
    this.logger.log(`📦 Seeded ${defaults.length} default models`)
    return { inserted: defaults.length }
  }
}

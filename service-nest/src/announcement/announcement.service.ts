import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { ObjectId } from 'mongodb'
import { DatabaseService } from '../database/database.service'

export interface Announcement {
  _id?: ObjectId
  content: string
  publishDate: Date
  type: string       // 'default' | 'important' | 'urgent'
  description: string // 说明信息
  createdBy: string   // userId
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class AnnouncementService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AnnouncementService.name)
  private readonly collectionName = 'announcements'

  constructor(private readonly databaseService: DatabaseService) {}

  async onApplicationBootstrap() {
    await this.ensureIndexes()
  }

  private async ensureIndexes() {
    try {
      const col = this.databaseService.getCollection(this.collectionName)
      await col.createIndex({ publishDate: -1 })
      await col.createIndex({ createdAt: -1 })
      this.logger.log('📇 announcements indexes ensured')
    } catch (error) {
      this.logger.warn(`⚠️ announcements index warning: ${error.message}`)
    }
  }

  /**
   * 创建公告
   */
  async create(data: {
    content: string
    publishDate?: string | Date
    type?: string
    description?: string
    createdBy: string
  }): Promise<Announcement> {
    const col = this.databaseService.getCollection(this.collectionName)

    const doc: Announcement = {
      content: data.content,
      publishDate: data.publishDate ? new Date(data.publishDate) : new Date(),
      type: data.type || 'default',
      description: data.description || '',
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await col.insertOne(doc as any)
    this.logger.log(`📢 Announcement created: ${result.insertedId}`)
    return { ...doc, _id: result.insertedId }
  }

  /**
   * 获取公告列表（分页，按发布日期倒序）
   */
  async getList(options: { page?: number; limit?: number } = {}) {
    const col = this.databaseService.getCollection(this.collectionName)
    const page = options.page || 1
    const limit = Math.min(options.limit || 20, 100)
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      col.find({})
        .sort({ publishDate: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      col.countDocuments({}),
    ])

    return { data, total, page, limit }
  }

  /**
   * 获取单个公告
   */
  async getById(id: string): Promise<Announcement | null> {
    const col = this.databaseService.getCollection(this.collectionName)
    try {
      return await col.findOne({ _id: new ObjectId(id) }) as any
    } catch {
      return null
    }
  }

  /**
   * 更新公告
   */
  async update(id: string, data: {
    content?: string
    publishDate?: string | Date
    type?: string
    description?: string
  }): Promise<boolean> {
    const col = this.databaseService.getCollection(this.collectionName)
    const update: any = { $set: { updatedAt: new Date() } }

    if (data.content !== undefined) update.$set.content = data.content
    if (data.publishDate !== undefined) update.$set.publishDate = new Date(data.publishDate)
    if (data.type !== undefined) update.$set.type = data.type
    if (data.description !== undefined) update.$set.description = data.description

    try {
      const result = await col.updateOne({ _id: new ObjectId(id) }, update)
      return result.modifiedCount > 0
    } catch {
      return false
    }
  }

  /**
   * 删除公告
   */
  async delete(id: string): Promise<boolean> {
    const col = this.databaseService.getCollection(this.collectionName)
    try {
      const result = await col.deleteOne({ _id: new ObjectId(id) })
      return result.deletedCount > 0
    } catch {
      return false
    }
  }

  /**
   * 批量删除公告
   */
  async deleteMany(ids: string[]): Promise<number> {
    const col = this.databaseService.getCollection(this.collectionName)
    try {
      const objectIds = ids.map(id => new ObjectId(id))
      const result = await col.deleteMany({ _id: { $in: objectIds } })
      return result.deletedCount
    } catch {
      return 0
    }
  }

  /**
   * 获取最新公告（供用户端展示）
   */
  async getLatest(limit: number = 5): Promise<any[]> {
    const col = this.databaseService.getCollection(this.collectionName)
    return col.find({ publishDate: { $lte: new Date() } })
      .sort({ publishDate: -1 })
      .limit(limit)
      .toArray()
  }
}

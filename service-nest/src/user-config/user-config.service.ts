import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { DatabaseService } from '../database/database.service'

/**
 * 用户级 API 配置（不含 port 等服务端配置）
 */
export interface UserApiConfig {
  sora: {
    server: string
    key: string
    characterServer: string
    characterKey: string
  }
  veo: {
    server: string
    key: string
  }
  geminiImage: {
    server: string
    key: string
  }
  grok: {
    server: string
    key: string
  }
  grokImage: {
    server: string
    key: string
  }
  doubao: {
    server: string
    key: string
  }
}

export interface UserConfigDocument {
  userId: string
  config: UserApiConfig
  created_at: Date
  updated_at: Date
}

@Injectable()
export class UserConfigService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserConfigService.name)
  private defaultConfig: UserApiConfig

  constructor(private readonly databaseService: DatabaseService) {
    this.defaultConfig = this.loadDefaultConfig()
  }

  async onApplicationBootstrap() {
    await this.ensureIndexes()
  }

  /**
   * 创建集合索引
   */
  private async ensureIndexes() {
    try {
      const collection = this.databaseService.getDb().collection('user_configs')
      await collection.createIndex({ userId: 1 }, { unique: true })
      this.logger.log('📇 user_configs collection indexes ensured')
    } catch (error) {
      this.logger.warn(`⚠️ user_configs index warning: ${error.message}`)
    }
  }

  /**
   * 从 config.example.json 加载默认配置作为新用户初始化模板
   */
  private loadDefaultConfig(): UserApiConfig {
    const examplePath = path.join(process.cwd(), 'config.example.json')
    try {
      if (fs.existsSync(examplePath)) {
        const content = fs.readFileSync(examplePath, 'utf-8')
        const config = JSON.parse(content)
        this.logger.log('📂 Default user config template loaded from config.example.json')

        // 提取 API 相关配置（去掉 port 等服务端字段）
        return {
          sora: {
            server: config.sora?.server || '',
            key: config.sora?.key || '',
            characterServer: config.sora?.characterServer || '',
            characterKey: config.sora?.characterKey || '',
          },
          veo: {
            server: config.veo?.server || '',
            key: config.veo?.key || '',
          },
          geminiImage: {
            server: config.geminiImage?.server || '',
            key: config.geminiImage?.key || '',
          },
          grok: {
            server: config.grok?.server || '',
            key: config.grok?.key || '',
          },
          grokImage: {
            server: config.grokImage?.server || '',
            key: config.grokImage?.key || '',
          },
          doubao: {
            server: config.doubao?.server || '',
            key: config.doubao?.key || '',
          },
        }
      }
    } catch (error) {
      this.logger.error(`❌ Failed to load config.example.json: ${error.message}`)
    }

    // 回退空配置
    return {
      sora: { server: '', key: '', characterServer: '', characterKey: '' },
      veo: { server: '', key: '' },
      geminiImage: { server: '', key: '' },
      grok: { server: '', key: '' },
      grokImage: { server: '', key: '' },
      doubao: { server: '', key: '' },
    }
  }

  /**
   * 获取默认配置模板（供新用户初始化）
   */
  getDefaultConfig(): UserApiConfig {
    return JSON.parse(JSON.stringify(this.defaultConfig))
  }

  // ===== CRUD =====

  /**
   * 为用户创建初始配置
   */
  async initUserConfig(userId: string): Promise<UserConfigDocument> {
    const collection = this.databaseService.getDb().collection('user_configs')

    // 检查是否已存在
    const existing = await collection.findOne({ userId }) as any
    if (existing) {
      this.logger.log(`📋 User config already exists for userId: ${userId}`)
      return existing as UserConfigDocument
    }

    const doc: UserConfigDocument = {
      userId,
      config: this.getDefaultConfig(),
      created_at: new Date(),
      updated_at: new Date(),
    }

    await collection.insertOne(doc as any)
    this.logger.log(`✅ Initialized default config for userId: ${userId}`)
    return doc
  }

  /**
   * 获取用户配置
   */
  async getUserConfig(userId: string): Promise<UserApiConfig> {
    const collection = this.databaseService.getDb().collection('user_configs')
    const doc = await collection.findOne({ userId }) as any

    if (!doc) {
      // 若不存在则自动初始化
      const created = await this.initUserConfig(userId)
      return created.config
    }

    // 将数据库配置与默认配置合并，确保新增字段不会缺失
    const defaults = this.getDefaultConfig()
    const stored = doc.config || {}
    return {
      sora: { ...defaults.sora, ...stored.sora },
      veo: { ...defaults.veo, ...stored.veo },
      geminiImage: { ...defaults.geminiImage, ...stored.geminiImage },
      grok: { ...defaults.grok, ...stored.grok },
      grokImage: { ...defaults.grokImage, ...stored.grokImage },
      doubao: { ...defaults.doubao, ...stored.doubao },
    }
  }

  /**
   * 获取用户配置（前端显示用，隐藏敏感信息）
   */
  async getUserConfigForDisplay(userId: string): Promise<any> {
    const config = await this.getUserConfig(userId)
    return {
      sora: {
        server: config.sora?.server ?? '',
        key: this.maskKey(config.sora?.key ?? ''),
        characterServer: config.sora?.characterServer ?? '',
        characterKey: this.maskKey(config.sora?.characterKey ?? ''),
      },
      veo: {
        server: config.veo?.server ?? '',
        key: this.maskKey(config.veo?.key ?? ''),
      },
      geminiImage: {
        server: config.geminiImage?.server ?? '',
        key: this.maskKey(config.geminiImage?.key ?? ''),
      },
      grok: {
        server: config.grok?.server ?? '',
        key: this.maskKey(config.grok?.key ?? ''),
      },
      grokImage: {
        server: config.grokImage?.server ?? '',
        key: this.maskKey(config.grokImage?.key ?? ''),
      },
      doubao: {
        server: config.doubao?.server ?? '',
        key: this.maskKey(config.doubao?.key ?? ''),
      },
    }
  }

  /**
   * 更新用户全部 API 配置
   */
  async updateUserConfig(userId: string, newConfig: Partial<UserApiConfig>): Promise<UserApiConfig> {
    const currentConfig = await this.getUserConfig(userId)
    const merged = this.deepMerge(currentConfig, newConfig)

    const collection = this.databaseService.getDb().collection('user_configs')
    await collection.updateOne(
      { userId },
      {
        $set: {
          config: merged,
          updated_at: new Date(),
        },
      },
      { upsert: true },
    )

    this.logger.log(`✅ Config updated for userId: ${userId}`)
    return merged
  }

  /**
   * 更新用户单个服务的配置
   */
  async updateUserServiceConfig(
    userId: string,
    service: 'sora' | 'veo' | 'geminiImage' | 'grok' | 'grokImage' | 'doubao',
    serviceConfig: { server?: string; key?: string; characterServer?: string; characterKey?: string },
  ): Promise<UserApiConfig> {
    const config = await this.getUserConfig(userId)

    if (service === 'sora') {
      if (serviceConfig.server !== undefined) config.sora.server = serviceConfig.server
      if (serviceConfig.key !== undefined) config.sora.key = serviceConfig.key
      if (serviceConfig.characterServer !== undefined) config.sora.characterServer = serviceConfig.characterServer
      if (serviceConfig.characterKey !== undefined) config.sora.characterKey = serviceConfig.characterKey
    } else if (service === 'veo') {
      if (serviceConfig.server !== undefined) config.veo.server = serviceConfig.server
      if (serviceConfig.key !== undefined) config.veo.key = serviceConfig.key
    } else if (service === 'geminiImage') {
      if (serviceConfig.server !== undefined) config.geminiImage.server = serviceConfig.server
      if (serviceConfig.key !== undefined) config.geminiImage.key = serviceConfig.key
    } else if (service === 'grok') {
      if (serviceConfig.server !== undefined) config.grok.server = serviceConfig.server
      if (serviceConfig.key !== undefined) config.grok.key = serviceConfig.key
    } else if (service === 'grokImage') {
      if (serviceConfig.server !== undefined) config.grokImage.server = serviceConfig.server
      if (serviceConfig.key !== undefined) config.grokImage.key = serviceConfig.key
    } else if (service === 'doubao') {
      if (serviceConfig.server !== undefined) config.doubao.server = serviceConfig.server
      if (serviceConfig.key !== undefined) config.doubao.key = serviceConfig.key
    }

    const collection = this.databaseService.getDb().collection('user_configs')
    await collection.updateOne(
      { userId },
      {
        $set: {
          config,
          updated_at: new Date(),
        },
      },
      { upsert: true },
    )

    this.logger.log(`✅ ${service} config updated for userId: ${userId}`)
    return config
  }

  /**
   * 获取用户特定服务的配置（供各服务模块调用）
   */
  async getUserSoraConfig(userId: string) {
    const config = await this.getUserConfig(userId)
    return config.sora
  }

  async getUserVeoConfig(userId: string) {
    const config = await this.getUserConfig(userId)
    return config.veo
  }

  async getUserGeminiImageConfig(userId: string) {
    const config = await this.getUserConfig(userId)
    return config.geminiImage
  }

  async getUserGrokConfig(userId: string) {
    const config = await this.getUserConfig(userId)
    return config.grok
  }

  async getUserGrokImageConfig(userId: string) {
    const config = await this.getUserConfig(userId)
    return config.grokImage
  }

  async getUserDoubaoConfig(userId: string) {
    const config = await this.getUserConfig(userId)
    return config.doubao
  }

  /**
   * 将默认 server+key 同步到所有服务配置
   * 用户可选择同步哪些字段（server / key），以及同步到哪些服务
   */
  async syncDefaultToAll(
    userId: string,
    defaultServer: string,
    defaultKey: string,
    options?: {
      syncServer?: boolean
      syncKey?: boolean
      services?: Array<'sora' | 'veo' | 'geminiImage' | 'grok' | 'grokImage' | 'doubao'>
    },
  ): Promise<UserApiConfig> {
    const config = await this.getUserConfig(userId)
    const syncServer = options?.syncServer !== false
    const syncKey = options?.syncKey !== false
    const services = options?.services || ['sora', 'veo', 'geminiImage', 'grok', 'grokImage', 'doubao']

    for (const service of services) {
      if (config[service]) {
        if (syncServer && defaultServer) {
          config[service].server = defaultServer
        }
        if (syncKey && defaultKey) {
          config[service].key = defaultKey
        }
      }
    }

    // Sora 额外同步 characterServer / characterKey
    if (services.includes('sora')) {
      if (syncServer && defaultServer) {
        config.sora.characterServer = defaultServer
      }
      if (syncKey && defaultKey) {
        config.sora.characterKey = defaultKey
      }
    }

    const collection = this.databaseService.getDb().collection('user_configs')
    await collection.updateOne(
      { userId },
      {
        $set: {
          config,
          updated_at: new Date(),
        },
      },
      { upsert: true },
    )

    this.logger.log(`✅ Default config synced to [${services.join(', ')}] for userId: ${userId}`)
    return config
  }

  // ===== 工具方法 =====

  private maskKey(key: string): string {
    if (!key || key.length < 12) return key ? '****' : ''
    return `${key.slice(0, 6)}****${key.slice(-6)}`
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target }
    for (const key in source) {
      if (source[key] instanceof Object && key in target && !(source[key] instanceof Array)) {
        result[key] = this.deepMerge(target[key], source[key])
      } else {
        result[key] = source[key]
      }
    }
    return result
  }
}

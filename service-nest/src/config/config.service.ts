import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { DatabaseService } from '../database/database.service'

export interface AppConfig {
  port: number
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
  kling: {
    server: string
    key: string
  }
  doubao: {
    server: string
    key: string
  }
  vidu: {
    server: string
    key: string
  }
  email: {
    smtpServer: string
    smtpPort: number
    smtpSSL: boolean
    smtpAccount: string
    smtpToken: string
    smtpFrom: string
  }
  tutorialUrl: string
  qrcodeUrl: string
  footerContent: string
}

@Injectable()
export class ConfigService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConfigService.name)
  private config: AppConfig
  private readonly configPath: string

  constructor(private readonly databaseService: DatabaseService) {
    this.configPath = path.join(process.cwd(), 'config.json')
    // 先用本地文件/默认值初始化，onModuleInit 中再从 MongoDB 加载
    this.config = this.loadConfigFromFile()
    this.logger.log('✅ Config service initialized (file fallback)')
  }

  /**
   * 模块初始化时从 MongoDB 加载配置
   */
  async onApplicationBootstrap() {
    try {
      const collection = this.databaseService.getDb().collection('config')
      const doc = await collection.findOne({ key: 'app_config' }) as any

      if (doc) {
        // 将 MongoDB 配置与默认配置合并，确保新增字段不会缺失
        const defaults = this.getDefaultConfig()
        const stored = doc.value || {}
        this.config = {
          port: stored.port ?? defaults.port,
          sora: { ...defaults.sora, ...stored.sora },
          veo: { ...defaults.veo, ...stored.veo },
          geminiImage: { ...defaults.geminiImage, ...stored.geminiImage },
          grok: { ...defaults.grok, ...stored.grok },
          grokImage: { ...defaults.grokImage, ...stored.grokImage },
          kling: { ...defaults.kling, ...stored.kling },
          doubao: { ...defaults.doubao, ...stored.doubao },
          vidu: { ...defaults.vidu, ...stored.vidu },
          email: { ...defaults.email, ...stored.email },
          tutorialUrl: stored.tutorialUrl ?? defaults.tutorialUrl,
          qrcodeUrl: stored.qrcodeUrl ?? defaults.qrcodeUrl,
          footerContent: stored.footerContent ?? defaults.footerContent,
        }
        this.logger.log('✅ Config loaded from MongoDB')
      } else {
        // MongoDB 中无配置，将当前配置（从文件/默认值）写入 MongoDB 作为种子数据
        await collection.insertOne({
          key: 'app_config',
          value: this.config,
          updatedAt: new Date(),
        } as any)
        this.logger.log('📝 Seed config written to MongoDB from file/defaults')
      }
    } catch (error) {
      this.logger.error(`❌ Failed to load config from MongoDB: ${error.message}`)
      this.logger.warn('⚠️ Falling back to file-based config')
    }
  }

  /**
   * 从文件加载配置（仅作初始化回退用）
   */
  private loadConfigFromFile(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8')
        const config = JSON.parse(content)
        this.logger.log(`📂 Config loaded from ${this.configPath}`)
        return config
      }
    } catch (error) {
      this.logger.error(`❌ Failed to load config file: ${error}`)
    }
    return this.getDefaultConfig()
  }

  /**
   * 从环境变量获取默认配置
   */
  private getDefaultConfig(): AppConfig {
    return {
      port: parseInt(process.env.PORT || '3003', 10),
      sora: {
        server: process.env.SORA_SERVER || '',
        key: process.env.SORA_KEY || '',
        characterServer: process.env.SORA_CHARACTER_SERVER || '',
        characterKey: process.env.SORA_CHARACTER_KEY || '',
      },
      veo: {
        server: process.env.VEO_SERVER || '',
        key: process.env.VEO_KEY || '',
      },
      geminiImage: {
        server: process.env.GEMINI_IMAGE_SERVER || '',
        key: process.env.GEMINI_IMAGE_KEY || '',
      },
      grok: {
        server: process.env.GROK_SERVER || '',
        key: process.env.GROK_KEY || '',
      },
      grokImage: {
        server: process.env.GROK_IMAGE_SERVER || '',
        key: process.env.GROK_IMAGE_KEY || '',
      },
      kling: {
        server: process.env.KLING_SERVER || '',
        key: process.env.KLING_KEY || '',
      },
      doubao: {
        server: process.env.DOUBAO_SERVER || '',
        key: process.env.DOUBAO_KEY || '',
      },
      vidu: {
        server: process.env.VIDU_SERVER || '',
        key: process.env.VIDU_KEY || '',
      },
      email: {
        smtpServer: process.env.SMTP_SERVER || 'smtp.163.com',
        smtpPort: parseInt(process.env.SMTP_PORT || '465', 10),
        smtpSSL: process.env.SMTP_SSL !== 'false',
        smtpAccount: process.env.SMTP_ACCOUNT || '18508593098@163.com',
        smtpToken: process.env.SMTP_TOKEN || 'AFPZvg9NRmqC5jZb',
        smtpFrom: process.env.SMTP_FROM || '18508593098@163.com',
      },
      tutorialUrl: process.env.TUTORIAL_URL || '',
      qrcodeUrl: process.env.QRCODE_URL || '',
      footerContent: process.env.FOOTER_CONTENT || '',
    }
  }

  /**
   * 获取完整配置（从内存缓存返回，通过 MongoDB 同步）
   */
  getConfig(): AppConfig {
    return this.config
  }

  /**
   * 从 MongoDB 刷新配置到内存
   */
  async refreshConfig(): Promise<AppConfig> {
    try {
      const collection = this.databaseService.getDb().collection('config')
      const doc = await collection.findOne({ key: 'app_config' }) as any
      if (doc) {
        const defaults = this.getDefaultConfig()
        const stored = doc.value || {}
        this.config = {
          port: stored.port ?? defaults.port,
          sora: { ...defaults.sora, ...stored.sora },
          veo: { ...defaults.veo, ...stored.veo },
          geminiImage: { ...defaults.geminiImage, ...stored.geminiImage },
          grok: { ...defaults.grok, ...stored.grok },
          grokImage: { ...defaults.grokImage, ...stored.grokImage },
          kling: { ...defaults.kling, ...stored.kling },
          doubao: { ...defaults.doubao, ...stored.doubao },
          vidu: { ...defaults.vidu, ...stored.vidu },
          email: { ...defaults.email, ...stored.email },
          tutorialUrl: stored.tutorialUrl ?? defaults.tutorialUrl,
          qrcodeUrl: stored.qrcodeUrl ?? defaults.qrcodeUrl,
          footerContent: stored.footerContent ?? defaults.footerContent,
        }
      }
    } catch (error) {
      this.logger.error(`❌ Failed to refresh config from MongoDB: ${error.message}`)
    }
    return this.config
  }

  /**
   * 获取配置（供前端显示，隐藏敏感信息）
   */
  getConfigForDisplay(): any {
    const config = this.getConfig()
    return {
      port: config.port,
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
      kling: {
        server: config.kling?.server ?? '',
        key: this.maskKey(config.kling?.key ?? ''),
      },
      doubao: {
        server: config.doubao?.server ?? '',
        key: this.maskKey(config.doubao?.key ?? ''),
      },
      vidu: {
        server: config.vidu?.server ?? '',
        key: this.maskKey(config.vidu?.key ?? ''),
      },
      email: {
        smtpServer: config.email?.smtpServer ?? '',
        smtpPort: config.email?.smtpPort ?? 465,
        smtpSSL: config.email?.smtpSSL ?? true,
        smtpAccount: config.email?.smtpAccount ?? '',
        smtpToken: this.maskKey(config.email?.smtpToken ?? ''),
        smtpFrom: config.email?.smtpFrom ?? '',
      },
      tutorialUrl: config.tutorialUrl ?? '',
      qrcodeUrl: config.qrcodeUrl ?? '',
      footerContent: config.footerContent ?? '',
    }
  }

  /**
   * 隐藏 API Key 中间部分
   */
  private maskKey(key: string): string {
    if (!key || key.length < 12) return key ? '****' : ''
    return `${key.slice(0, 6)}****${key.slice(-6)}`
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig: Partial<AppConfig>): Promise<AppConfig> {
    const currentConfig = this.getConfig()
    
    // 深度合并配置
    this.config = this.deepMerge(currentConfig, newConfig)
    
    // 保存到 MongoDB
    await this.saveConfig()
    
    this.logger.log('✅ Config updated and saved to MongoDB')
    return this.config
  }

  /**
   * 更新单个服务配置
   */
  async updateServiceConfig(
    service: 'sora' | 'veo' | 'geminiImage' | 'grok' | 'grokImage' | 'kling' | 'doubao' | 'vidu' | 'email' | 'tutorial' | 'qrcode' | 'footer',
    config: { server?: string; key?: string; characterServer?: string; characterKey?: string; smtpServer?: string; smtpPort?: number; smtpSSL?: boolean; smtpAccount?: string; smtpToken?: string; smtpFrom?: string; url?: string; content?: string },
  ): Promise<AppConfig> {
    const currentConfig = this.getConfig()
    
    // 确保子对象存在
    if (!currentConfig.sora) currentConfig.sora = { server: '', key: '', characterServer: '', characterKey: '' }
    if (!currentConfig.veo) currentConfig.veo = { server: '', key: '' }
    if (!currentConfig.geminiImage) currentConfig.geminiImage = { server: '', key: '' }
    if (!currentConfig.grok) currentConfig.grok = { server: '', key: '' }
    if (!currentConfig.grokImage) currentConfig.grokImage = { server: '', key: '' }
    if (!currentConfig.kling) currentConfig.kling = { server: '', key: '' }
    if (!currentConfig.doubao) currentConfig.doubao = { server: '', key: '' }
    if (!currentConfig.vidu) currentConfig.vidu = { server: '', key: '' }
    if (!currentConfig.email) currentConfig.email = { smtpServer: 'smtp.163.com', smtpPort: 465, smtpSSL: true, smtpAccount: '', smtpToken: '', smtpFrom: '' }

    if (service === 'sora') {
      if (config.server !== undefined) currentConfig.sora.server = config.server
      if (config.key !== undefined) currentConfig.sora.key = config.key
      if (config.characterServer !== undefined) currentConfig.sora.characterServer = config.characterServer
      if (config.characterKey !== undefined) currentConfig.sora.characterKey = config.characterKey
    } else if (service === 'veo') {
      if (config.server !== undefined) currentConfig.veo.server = config.server
      if (config.key !== undefined) currentConfig.veo.key = config.key
    } else if (service === 'geminiImage') {
      if (config.server !== undefined) currentConfig.geminiImage.server = config.server
      if (config.key !== undefined) currentConfig.geminiImage.key = config.key
    } else if (service === 'grok') {
      if (config.server !== undefined) currentConfig.grok.server = config.server
      if (config.key !== undefined) currentConfig.grok.key = config.key
    } else if (service === 'grokImage') {
      if (config.server !== undefined) currentConfig.grokImage.server = config.server
      if (config.key !== undefined) currentConfig.grokImage.key = config.key
    } else if (service === 'kling') {
      if (config.server !== undefined) currentConfig.kling.server = config.server
      if (config.key !== undefined) currentConfig.kling.key = config.key
    } else if (service === 'doubao') {
      if (config.server !== undefined) currentConfig.doubao.server = config.server
      if (config.key !== undefined) currentConfig.doubao.key = config.key
    } else if (service === 'vidu') {
      if (config.server !== undefined) currentConfig.vidu.server = config.server
      if (config.key !== undefined) currentConfig.vidu.key = config.key
    } else if (service === 'email') {
      if (config.smtpServer !== undefined) currentConfig.email.smtpServer = config.smtpServer
      if (config.smtpPort !== undefined) currentConfig.email.smtpPort = config.smtpPort
      if (config.smtpSSL !== undefined) currentConfig.email.smtpSSL = config.smtpSSL
      if (config.smtpAccount !== undefined) currentConfig.email.smtpAccount = config.smtpAccount
      if (config.smtpToken !== undefined) currentConfig.email.smtpToken = config.smtpToken
      if (config.smtpFrom !== undefined) currentConfig.email.smtpFrom = config.smtpFrom
    } else if (service === 'tutorial') {
      if (config.url !== undefined) currentConfig.tutorialUrl = config.url
    } else if (service === 'qrcode') {
      if (config.url !== undefined) currentConfig.qrcodeUrl = config.url
    } else if (service === 'footer') {
      if (config.content !== undefined) currentConfig.footerContent = config.content
    }

    this.config = currentConfig
    await this.saveConfig()
    
    this.logger.log(`✅ ${service} config updated in MongoDB`)
    return this.config
  }

  /**
   * 保存配置到 MongoDB
   */
  private async saveConfig(): Promise<void> {
    try {
      const collection = this.databaseService.getDb().collection('config')
      await collection.updateOne(
        { key: 'app_config' },
        {
          $set: {
            value: this.config,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      )
      this.logger.log('💾 Config saved to MongoDB')
    } catch (error) {
      this.logger.error(`❌ Failed to save config to MongoDB: ${error.message}`)
      throw error
    }
  }

  /**
   * 深度合并对象
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target }
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        result[key] = this.deepMerge(target[key], source[key])
      } else {
        result[key] = source[key]
      }
    }
    return result
  }

  // ===== 便捷获取方法 =====

  getSoraConfig() {
    return this.getConfig().sora || { server: '', key: '', characterServer: '', characterKey: '' }
  }

  getVeoConfig() {
    return this.getConfig().veo || { server: '', key: '' }
  }

  getGeminiImageConfig() {
    return this.getConfig().geminiImage || { server: '', key: '' }
  }

  getGrokConfig() {
    return this.getConfig().grok || { server: '', key: '' }
  }

  getGrokImageConfig() {
    return this.getConfig().grokImage || { server: '', key: '' }
  }

  getKlingConfig() {
    return this.getConfig().kling || { server: '', key: '' }
  }

  getDoubaoConfig() {
    return this.getConfig().doubao || { server: '', key: '' }
  }

  getViduConfig() {
    return this.getConfig().vidu || { server: '', key: '' }
  }

  getEmailConfig() {
    return this.getConfig().email || {
      smtpServer: 'smtp.163.com',
      smtpPort: 465,
      smtpSSL: true,
      smtpAccount: '',
      smtpToken: '',
      smtpFrom: '',
    }
  }
}

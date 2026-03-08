import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as FormData from 'form-data'
import { CreateGrokVideoDto } from './dto/create-grok-video.dto'
import { ConfigService } from '../config/config.service'
import { UserConfigService } from '../user-config/user-config.service'
import { FileStorageService } from '../file-storage/file-storage.service'

@Injectable()
export class GrokVideoService {
  private readonly logger = new Logger(GrokVideoService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly userConfigService: UserConfigService,
    private readonly fileStorageService: FileStorageService,
  ) {
    const config = this.configService.getGrokConfig()
    this.logger.log(`🔧 Grok Server: ${config.server}`)
    this.logger.log(`🔑 Grok Key: ${config.key ? `****${config.key.slice(-8)}` : 'NOT SET'}`)
  }

  /**
   * 获取用户级 Grok 配置（优先用户配置，回退全局配置）
   */
  private async getUserGrokConfig(userId: string) {
    try {
      const userConfig = await this.userConfigService.getUserConfig(userId)
      if (userConfig.grok?.server) {
        return userConfig.grok
      }
    } catch (e) {
      this.logger.warn(`⚠️ Failed to load user config for ${userId}, using global`)
    }
    return this.configService.getGrokConfig()
  }

  /**
   * 创建 Grok 视频任务（支持参考图）
   * aifast 渠道: POST /v1/videos (multipart/form-data)
   * xiaohumini 渠道: POST /v1/video/create (JSON)
   */
  async createVideo(dto: CreateGrokVideoDto, files?: Express.Multer.File[], userId?: string, baseUrl?: string): Promise<any> {
    const config = await this.getUserGrokConfig(userId || 'unknown')
    const channel = dto.channel || 'aifast'

    this.logger.log(`📤 Creating Grok video [${channel}] with model: ${dto.model}`)
    this.logger.log(`📝 Prompt: ${dto.prompt}`)

    if (channel === 'xiaohumini') {
      return this.createVideoXiaohumini(dto, files, config, userId || 'unknown', baseUrl)
    }

    return this.createVideoAifast(dto, files, config)
  }

  /**
   * aifast 渠道创建视频
   * POST {server}/v1/videos (multipart/form-data)
   */
  private async createVideoAifast(dto: CreateGrokVideoDto, files: Express.Multer.File[] | undefined, config: { server: string; key: string }): Promise<any> {
    const formData = new FormData()

    formData.append('model', dto.model || 'grok-video-3')
    formData.append('prompt', dto.prompt)

    if (dto.aspect_ratio) {
      formData.append('aspect_ratio', dto.aspect_ratio)
    }

    if (dto.seconds) {
      formData.append('seconds', String(dto.seconds))
    }

    if (dto.size) {
      formData.append('size', dto.size)
    }

    if (files && files.length > 0) {
      this.logger.log(`🖼️ Adding ${files.length} reference images`)
      for (const file of files) {
        formData.append('input_reference', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        })
      }
    }

    const response = await axios.post(
      `${config.server}/v1/videos`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 120000,
      },
    )

    return response.data
  }

  /**
   * xiaohumini 渠道创建视频
   * POST {server}/v1/video/create (JSON)
   * 支持上传本地文件：先保存到本地再生成URL传给API
   */
  private async createVideoXiaohumini(
    dto: CreateGrokVideoDto,
    files: Express.Multer.File[] | undefined,
    config: { server: string; key: string },
    userId: string,
    baseUrl?: string,
  ): Promise<any> {
    let images: string[] = []

    // 优先处理上传的文件：保存到本地并生成可访问的URL
    if (files && files.length > 0 && baseUrl) {
      this.logger.log(`🖼️ Saving ${files.length} uploaded files for xiaohumini channel`)
      const prefix = `grok_${Date.now()}`
      for (const file of files) {
        const urlPath = this.fileStorageService.saveUploadedFile(userId, file, prefix)
        const fullUrl = `${baseUrl}${urlPath}`
        images.push(fullUrl)
        this.logger.log(`📎 File saved: ${fullUrl}`)
      }
    }

    // 再追加 DTO 中传入的 URL
    if (dto.images) {
      try {
        const parsed = JSON.parse(dto.images)
        if (Array.isArray(parsed)) {
          images = [...images, ...parsed]
        }
      } catch {
        const urls = dto.images.split(',').map(s => s.trim()).filter(Boolean)
        images = [...images, ...urls]
      }
    }

    const body: any = {
      model: dto.model || 'grok-video-3',
      prompt: dto.prompt,
      aspect_ratio: dto.aspect_ratio || '3:2',
      size: dto.size || '720P',
      images,
    }

    this.logger.log(`📤 xiaohumini request: ${JSON.stringify(body)}`)

    const response = await axios.post(
      `${config.server}/v1/video/create`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 120000,
      },
    )

    return response.data
  }

  /**
   * 查询 Grok 视频任务状态
   * aifast 渠道: GET /v1/videos/{taskId}
   * xiaohumini 渠道: GET /v1/video/query?id={taskId}
   */
  async queryVideo(taskId: string, userId?: string, channel?: string): Promise<any> {
    const config = await this.getUserGrokConfig(userId || 'unknown')
    const ch = channel || 'aifast'

    this.logger.log(`📤 Querying Grok task [${ch}]: ${taskId}`)

    if (ch === 'xiaohumini') {
      return this.queryVideoXiaohumini(taskId, config)
    }

    return this.queryVideoAifast(taskId, config)
  }

  /**
   * aifast 渠道查询视频
   * GET {server}/v1/videos/{taskId}
   */
  private async queryVideoAifast(taskId: string, config: { server: string; key: string }): Promise<any> {
    const response = await axios.get(
      `${config.server}/v1/videos/${encodeURIComponent(taskId)}`,
      {
        headers: {
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 30000,
      },
    )

    return response.data
  }

  /**
   * xiaohumini 渠道查询视频
   * GET {server}/v1/video/query?id={taskId}
   */
  private async queryVideoXiaohumini(taskId: string, config: { server: string; key: string }): Promise<any> {
    const response = await axios.get(
      `${config.server}/v1/video/query`,
      {
        params: { id: taskId },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 30000,
      },
    )

    return response.data
  }
}

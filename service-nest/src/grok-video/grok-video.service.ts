import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as FormData from 'form-data'
import { CreateGrokVideoDto } from './dto/create-grok-video.dto'
import { ConfigService } from '../config/config.service'
import { UserConfigService } from '../user-config/user-config.service'

@Injectable()
export class GrokVideoService {
  private readonly logger = new Logger(GrokVideoService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly userConfigService: UserConfigService,
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
  async createVideo(dto: CreateGrokVideoDto, files?: Express.Multer.File[], userId?: string): Promise<any> {
    const config = await this.getUserGrokConfig(userId || 'unknown')
    const channel = dto.channel || 'aifast'

    this.logger.log(`📤 Creating Grok video [${channel}] with model: ${dto.model}`)
    this.logger.log(`📝 Prompt: ${dto.prompt}`)

    if (channel === 'xiaohumini') {
      return this.createVideoXiaohumini(dto, config)
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
   */
  private async createVideoXiaohumini(dto: CreateGrokVideoDto, config: { server: string; key: string }): Promise<any> {
    let images: string[] = []
    if (dto.images) {
      try {
        images = JSON.parse(dto.images)
      } catch {
        images = dto.images.split(',').map(s => s.trim()).filter(Boolean)
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

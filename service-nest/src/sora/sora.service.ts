import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as FormData from 'form-data'
import { CreateVideoDto } from './dto/create-video.dto'
import { ConfigService } from '../config/config.service'
import { UserConfigService } from '../user-config/user-config.service'

@Injectable()
export class SoraService {
  private readonly logger = new Logger(SoraService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly userConfigService: UserConfigService,
  ) {
    const config = this.configService.getSoraConfig()
    this.logger.log(`🔧 Sora Server: ${config.server}`)
    this.logger.log(`🔑 Sora Key: ${config.key ? `****${config.key.slice(-8)}` : 'NOT SET'}`)
  }

  /**
   * 获取用户级 Sora 配置（优先用户配置，回退全局配置）
   */
  private async getUserSoraConfig(userId: string) {
    try {
      const userConfig = await this.userConfigService.getUserConfig(userId)
      if (userConfig.sora?.server) {
        return userConfig.sora
      }
    } catch (e) {
      this.logger.warn(`⚠️ Failed to load user config for ${userId}, using global`)
    }
    return this.configService.getSoraConfig()
  }

  /**
   * 创建视频任务（multipart/form-data 格式，上游 POST /v1/videos）
   */
  async createVideo(dto: CreateVideoDto, files?: Express.Multer.File[], userId?: string): Promise<any> {
    const config = await this.getUserSoraConfig(userId || 'unknown')

    this.logger.log(`📤 Creating Sora video with model: ${dto.model}`)
    this.logger.log(`📝 Prompt: ${dto.prompt}`)

    const formData = new FormData()

    // 必填字段
    formData.append('model', dto.model || 'sora-2')
    formData.append('prompt', dto.prompt)

    // 可选字段
    if (dto.size) {
      formData.append('size', dto.size)
    }
    if (dto.seconds) {
      formData.append('seconds', String(dto.seconds))
    }
    if (dto.character_url) {
      formData.append('character_url', dto.character_url)
    }
    if (dto.character_timestamps) {
      formData.append('character_timestamps', dto.character_timestamps)
    }

    // 参考图（文件上传）
    if (files && files.length > 0) {
      this.logger.log(`🖼️ Adding ${files.length} reference images`)
      for (const file of files) {
        formData.append('input_reference', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        })
      }
    }

    this.logger.log(`📤 Sending create request to: ${config.server}/v1/videos`)

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
   * 查询视频任务状态
   */
  async queryVideo(taskId: string, userId: string): Promise<any> {
    const config = await this.getUserSoraConfig(userId)
    const url = `${config.server}/v1/videos/${encodeURIComponent(taskId)}`

    this.logger.log(`📤 Sending query request for task: ${taskId}`)
    this.logger.log(`🔗 Full URL: ${url}`)

    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 30000,
      })
      return response.data
    } catch (error) {
      this.logger.error(`❌ Query failed for task: ${taskId}`)
      this.logger.error(`📋 Status: ${error.response?.status}`)
      this.logger.error(`📋 Response data: ${JSON.stringify(error.response?.data, null, 2)}`)
      throw error
    }
  }
}

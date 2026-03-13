import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as FormData from 'form-data'
import { CreateVeoVideoDto } from './dto/create-veo-video.dto'
import { ConfigService } from '../config/config.service'
import { UserConfigService } from '../user-config/user-config.service'

@Injectable()
export class VeoService {
  private readonly logger = new Logger(VeoService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly userConfigService: UserConfigService,
  ) {
    const config = this.configService.getVeoConfig()
    this.logger.log(`🔧 VEO Server: ${config.server}`)
    this.logger.log(`🔑 VEO Key: ${config.key ? `****${config.key.slice(-8)}` : 'NOT SET'}`)
  }

  /**
   * 获取用户级 VEO 配置（优先用户配置，回退全局配置）
   */
  async getUserVeoConfig(userId: string) {
    try {
      const userConfig = await this.userConfigService.getUserConfig(userId)
      if (userConfig.veo?.server) {
        return userConfig.veo
      }
    } catch (e) {
      this.logger.warn(`⚠️ Failed to load user config for ${userId}, using global`)
    }
    return this.configService.getVeoConfig()
  }

  /**
   * 创建 VEO 视频任务（支持参考图）
   */
  async createVideo(dto: CreateVeoVideoDto, files?: Express.Multer.File[], userId?: string): Promise<any> {
    const config = await this.getUserVeoConfig(userId || 'unknown')
    
    this.logger.log(`📤 Creating VEO video with model: ${dto.model}`)
    this.logger.log(`📝 Prompt: ${dto.prompt}`)

    const formData = new FormData()
    
    // 添加基础参数
    formData.append('model', dto.model || 'veo_3_1-fast')
    formData.append('prompt', dto.prompt)
    
    if (dto.size) {
      formData.append('size', dto.size)
    }
    
    if (dto.seconds) {
      formData.append('seconds', String(dto.seconds))
    }

    // 添加参考图（如果有）
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
      }
    )

    return response.data
  }

  /**
   * 查询 VEO 视频任务状态
   */
  async queryVideo(taskId: string, userId?: string): Promise<any> {
    const config = await this.getUserVeoConfig(userId || 'unknown')
    
    this.logger.log(`📤 Querying VEO task: ${taskId}`)

    const response = await axios.get(
      `${config.server}/v1/videos/${encodeURIComponent(taskId)}`,
      {
        headers: {
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 30000,
      }
    )

    return response.data
  }
}

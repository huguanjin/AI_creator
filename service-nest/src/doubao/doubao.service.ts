import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as FormData from 'form-data'
import { CreateDoubaoVideoDto } from './dto/create-doubao-video.dto'
import { ConfigService } from '../config/config.service'
import { UserConfigService } from '../user-config/user-config.service'

@Injectable()
export class DoubaoService {
  private readonly logger = new Logger(DoubaoService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly userConfigService: UserConfigService,
  ) {
    const config = this.configService.getDoubaoConfig()
    this.logger.log(`🔧 Doubao Server: ${config.server}`)
    this.logger.log(`🔑 Doubao Key: ${config.key ? `****${config.key.slice(-8)}` : 'NOT SET'}`)
  }

  /**
   * 获取用户级豆包配置（优先用户配置，回退全局配置）
   */
  private async getUserDoubaoConfig(userId: string) {
    try {
      const userConfig = await this.userConfigService.getUserConfig(userId)
      if (userConfig.doubao?.server) {
        return userConfig.doubao
      }
    } catch (e) {
      this.logger.warn(`⚠️ Failed to load user config for ${userId}, using global`)
    }
    return this.configService.getDoubaoConfig()
  }

  /**
   * 创建豆包视频任务（multipart/form-data，支持首帧/尾帧图片）
   * 上游 API: POST /v1/videos
   */
  async createVideo(
    dto: CreateDoubaoVideoDto,
    firstFrameFile?: Express.Multer.File,
    lastFrameFile?: Express.Multer.File,
    userId?: string,
  ): Promise<any> {
    const config = await this.getUserDoubaoConfig(userId || 'unknown')

    this.logger.log(`📤 Creating Doubao video with model: ${dto.model}`)
    this.logger.log(`📝 Prompt: ${dto.prompt}`)

    const formData = new FormData()

    // 必填字段
    formData.append('model', dto.model || 'doubao-seedance-1-5-pro_720p')
    formData.append('prompt', dto.prompt)

    // 可选字段
    if (dto.size) {
      formData.append('size', dto.size)
    }
    if (dto.seconds) {
      formData.append('seconds', String(dto.seconds))
    }

    // 首帧图片
    if (firstFrameFile) {
      this.logger.log(`🖼️ Adding first frame image: ${firstFrameFile.originalname}`)
      formData.append('first_frame_image', firstFrameFile.buffer, {
        filename: firstFrameFile.originalname,
        contentType: firstFrameFile.mimetype,
      })
    }

    // 尾帧图片
    if (lastFrameFile) {
      this.logger.log(`🖼️ Adding last frame image: ${lastFrameFile.originalname}`)
      formData.append('last_frame_image', lastFrameFile.buffer, {
        filename: lastFrameFile.originalname,
        contentType: lastFrameFile.mimetype,
      })
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
   * 查询豆包视频任务状态
   * 上游 API: GET /v1/videos/{task_id}
   */
  async queryVideo(taskId: string, userId?: string): Promise<any> {
    const config = await this.getUserDoubaoConfig(userId || 'unknown')

    this.logger.log(`📤 Querying Doubao task: ${taskId}`)

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
}

import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as FormData from 'form-data'
import { CreateKlingVideoDto } from './dto/create-kling-video.dto'
import { ConfigService } from '../config/config.service'
import { UserConfigService } from '../user-config/user-config.service'

@Injectable()
export class KlingService {
  private readonly logger = new Logger(KlingService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly userConfigService: UserConfigService,
  ) {
    const config = this.configService.getKlingConfig()
    this.logger.log(`🔧 Kling Server: ${config.server}`)
    this.logger.log(`🔑 Kling Key: ${config.key ? `****${config.key.slice(-8)}` : 'NOT SET'}`)
  }

  /**
   * 获取用户级可灵配置（优先用户配置，回退全局配置）
   */
  private async getUserKlingConfig(userId: string) {
    try {
      const userConfig = await this.userConfigService.getUserConfig(userId)
      if (userConfig.kling?.server) {
        return userConfig.kling
      }
    } catch (e) {
      this.logger.warn(`⚠️ Failed to load user config for ${userId}, using global`)
    }
    return this.configService.getKlingConfig()
  }

  /**
   * 创建可灵视频任务
   * 有文件上传时使用 multipart/form-data，否则使用 JSON
   */
  async createVideo(
    dto: CreateKlingVideoDto,
    userId?: string,
    imageFile?: Express.Multer.File,
    lastFrameFile?: Express.Multer.File,
    referenceFiles?: Express.Multer.File[],
  ): Promise<any> {
    const config = await this.getUserKlingConfig(userId || 'unknown')

    this.logger.log(`📤 Creating Kling video with model: ${dto.model}`)
    this.logger.log(`📝 Prompt: ${dto.prompt}`)
    this.logger.log(`🔗 Server: ${config.server}`)

    const hasFiles = !!imageFile || !!lastFrameFile || (referenceFiles && referenceFiles.length > 0)

    if (hasFiles) {
      return this.createVideoWithFormData(dto, config, imageFile, lastFrameFile, referenceFiles)
    }
    return this.createVideoJson(dto, config)
  }

  /**
   * JSON 方式创建（纯 URL 参考图 / 纯文生视频）
   */
  private async createVideoJson(dto: CreateKlingVideoDto, config: { server: string; key: string }): Promise<any> {
    const body: any = {
      model: dto.model,
      prompt: dto.prompt,
    }

    if (dto.seconds) body.seconds = dto.seconds
    if (dto.size) body.size = dto.size
    if (dto.image) body.image = dto.image

    if (dto.images) {
      try {
        body.images = JSON.parse(dto.images)
      } catch {
        body.images = dto.images.split(',').map(s => s.trim()).filter(Boolean)
      }
    }

    if (dto.metadata) {
      try {
        body.metadata = JSON.parse(dto.metadata)
      } catch {
        this.logger.warn('⚠️ Failed to parse metadata JSON, ignoring')
      }
    }

    this.logger.log(`📤 Sending JSON create request to: ${config.server}/v1/videos`)
    this.logger.log(`📦 Request body: ${JSON.stringify(body).slice(0, 500)}`)

    const response = await axios.post(
      `${config.server}/v1/videos`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 120000,
      },
    )

    return response.data
  }

  /**
   * FormData 方式创建（有本地文件上传）
   * 参考豆包 aifast 渠道的 multipart/form-data 实现
   */
  private async createVideoWithFormData(
    dto: CreateKlingVideoDto,
    config: { server: string; key: string },
    imageFile?: Express.Multer.File,
    lastFrameFile?: Express.Multer.File,
    referenceFiles?: Express.Multer.File[],
  ): Promise<any> {
    const formData = new FormData()

    formData.append('model', dto.model)
    formData.append('prompt', dto.prompt)
    if (dto.seconds) formData.append('seconds', dto.seconds)
    if (dto.size) formData.append('size', dto.size)

    // 参考图：优先本地文件，其次 URL
    if (imageFile) {
      this.logger.log(`🖼️ Adding image file: ${imageFile.originalname}`)
      formData.append('image', imageFile.buffer, {
        filename: imageFile.originalname,
        contentType: imageFile.mimetype,
      })
    } else if (dto.image) {
      formData.append('image', dto.image)
    }

    // 尾帧图文件
    if (lastFrameFile) {
      this.logger.log(`🖼️ Adding last frame file: ${lastFrameFile.originalname}`)
      formData.append('last_frame_image', lastFrameFile.buffer, {
        filename: lastFrameFile.originalname,
        contentType: lastFrameFile.mimetype,
      })
    }

    // 多张参考图文件
    if (referenceFiles && referenceFiles.length > 0) {
      this.logger.log(`🖼️ Adding ${referenceFiles.length} reference files`)
      for (const file of referenceFiles) {
        formData.append('reference_images', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        })
      }
    } else if (dto.images) {
      // 没有文件时用 URL 列表
      try {
        const parsed = JSON.parse(dto.images)
        formData.append('images', JSON.stringify(parsed))
      } catch {
        const urls = dto.images.split(',').map(s => s.trim()).filter(Boolean)
        formData.append('images', JSON.stringify(urls))
      }
    }

    // metadata 扩展参数
    if (dto.metadata) {
      try {
        const parsed = JSON.parse(dto.metadata)
        // 尾帧文件覆盖 URL
        if (lastFrameFile && parsed.last_frame_url) {
          delete parsed.last_frame_url
        }
        formData.append('metadata', JSON.stringify(parsed))
      } catch {
        this.logger.warn('⚠️ Failed to parse metadata JSON, ignoring')
      }
    }

    this.logger.log(`📤 Sending FormData create request to: ${config.server}/v1/videos`)

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
   * 查询可灵视频任务状态
   * GET {server}/v1/videos/{task_id}
   */
  async queryVideo(taskId: string, userId?: string): Promise<any> {
    const config = await this.getUserKlingConfig(userId || 'unknown')

    this.logger.log(`📤 Querying Kling task: ${taskId}`)

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

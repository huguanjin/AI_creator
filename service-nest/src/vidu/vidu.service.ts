import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as https from 'https'
import * as crypto from 'crypto'
import { CreateViduVideoDto } from './dto/create-vidu-video.dto'
import { ConfigService } from '../config/config.service'
import { UserConfigService } from '../user-config/user-config.service'

@Injectable()
export class ViduService {
  private readonly logger = new Logger(ViduService.name)
  private readonly httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    ciphers: 'DEFAULT@SECLEVEL=0',
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
  })

  constructor(
    private readonly configService: ConfigService,
    private readonly userConfigService: UserConfigService,
  ) {
    const config = this.configService.getViduConfig()
    this.logger.log(`🔧 Vidu Server: ${config.server}`)
    this.logger.log(`🔑 Vidu Key: ${config.key ? `****${config.key.slice(-8)}` : 'NOT SET'}`)
  }

  /**
   * 获取用户级 Vidu 配置（优先用户配置，回退全局配置）
   * 两个渠道共用同一套 API 配置
   */
  async getUserViduConfig(userId: string) {
    try {
      const userConfig = await this.userConfigService.getUserConfig(userId)
      if (userConfig.vidu?.server) {
        return userConfig.vidu
      }
    } catch (e) {
      this.logger.warn(`⚠️ Failed to load user config for ${userId}, using global`)
    }
    return this.configService.getViduConfig()
  }

  /**
   * 根据任务类型获取对应的 API 路径（测试接口官转接口1）
   */
  private getEndpoint(taskType: string): string {
    switch (taskType) {
      case 'img2video':
        return '/api/v1/video/vidu/img2video'
      case 'reference2video':
        return '/api/v1/video/vidu/reference2video'
      case 'start-end2video':
        return '/api/v1/video/vidu/start-end2video'
      case 'text2video':
      default:
        return '/api/v1/video/vidu/text2video'
    }
  }

  /**
   * 创建 Vidu 视频任务
   */
  async createVideo(dto: CreateViduVideoDto, files?: Express.Multer.File[], userId?: string): Promise<any> {
    const channel = dto.channel || 'aifast'

    if (channel === 'aifast') {
      return this.createVideoAifast(dto, files, userId || 'unknown')
    }

    return this.createVideoDefault(dto, files, userId || 'unknown')
  }

  /**
   * 测试接口官转接口1 - 创建视频
   */
  private async createVideoDefault(dto: CreateViduVideoDto, files?: Express.Multer.File[], userId?: string): Promise<any> {
    const config = await this.getUserViduConfig(userId || 'unknown')
    const taskType = dto.task_type || 'text2video'

    this.logger.log(`📤 [测试接口官转接口1] Creating Vidu video [${taskType}] with model: ${dto.model}`)
    this.logger.log(`📝 Prompt: ${dto.prompt}`)
    this.logger.log(`🔗 Server: ${config.server}`)

    const endpoint = this.getEndpoint(taskType)

    // 构建请求体
    const body: any = {
      model: dto.model || 'TC-vidu-q2',
      prompt: dto.prompt,
    }

    if (dto.duration) {
      body.duration = dto.duration
    }

    if (dto.aspect_ratio) {
      body.aspect_ratio = dto.aspect_ratio
    }

    if (dto.resolution) {
      body.resolution = dto.resolution
    }

    if (dto.off_peak !== undefined) {
      body.off_peak = dto.off_peak
    }

    // 处理图片 (图生视频 / 首尾帧)
    if (taskType === 'img2video' || taskType === 'start-end2video') {
      let images: string[] = []

      // 将上传的文件转为 base64 Data URI
      if (files && files.length > 0) {
        this.logger.log(`🖼️ Converting ${files.length} uploaded files to base64 data URIs`)
        for (const file of files) {
          const base64 = file.buffer.toString('base64')
          const mimeType = file.mimetype || 'image/png'
          const dataUri = `data:${mimeType};base64,${base64}`
          images.push(dataUri)
        }
      }

      // 追加 DTO 中传入的 URL
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

      if (images.length > 0) {
        body.images = images
      }
    }

    // 处理参考主体 (参考生视频)
    if (taskType === 'reference2video' && dto.subjects) {
      try {
        body.subjects = JSON.parse(dto.subjects)
      } catch {
        this.logger.warn('⚠️ Failed to parse subjects JSON')
      }
    }

    this.logger.log(`📤 Vidu request body: ${JSON.stringify(body).substring(0, 500)}`)

    const response = await axios.post(
      `${config.server}${endpoint}`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 120000,
        httpsAgent: this.httpsAgent,
      },
    )

    const data = response.data

    // 标准化响应格式
    return {
      id: data.task_id || data.id,
      status: this.mapStatus(data.state),
      model: data.model || dto.model,
      prompt: data.prompt || dto.prompt,
      credits: data.credits,
      duration: data.duration,
      error: data.error_msg,
      created_at: data.created_at,
      channel: 'default',
      raw: data,
    }
  }

  /**
   * AIFAST站 - 创建视频
   * POST {server}/v1/video/generations
   */
  private async createVideoAifast(dto: CreateViduVideoDto, files?: Express.Multer.File[], userId?: string): Promise<any> {
    const config = await this.getUserViduConfig(userId || 'unknown')
    const taskType = dto.task_type || 'text2video'

    this.logger.log(`📤 [AIFAST] Creating Vidu video [${taskType}] with model: ${dto.model}`)
    this.logger.log(`📝 Prompt: ${dto.prompt}`)
    this.logger.log(`🔗 Server: ${config.server}`)

    // 构建 AIFAST 格式请求体
    const body: any = {
      model: dto.model || 'TC-vidu-q2',
      prompt: dto.prompt,
    }

    if (dto.duration) {
      body.duration = dto.duration
    }

    // AIFAST 使用 size 字段（对应上游 resolution）
    if (dto.resolution) {
      body.size = dto.resolution
    }

    // 构建 metadata
    const metadata: any = {}

    if (dto.aspect_ratio) {
      metadata.aspect_ratio = dto.aspect_ratio
    }

    if (dto.off_peak !== undefined) {
      metadata.off_peak = dto.off_peak
    }

    // 处理图片 (图生视频 / 首尾帧)
    if (taskType === 'img2video' || taskType === 'start-end2video') {
      let images: string[] = []

      // 将上传的文件转为 base64 Data URI
      if (files && files.length > 0) {
        this.logger.log(`🖼️ Converting ${files.length} uploaded files to base64 data URIs`)
        for (const file of files) {
          const base64 = file.buffer.toString('base64')
          const mimeType = file.mimetype || 'image/png'
          const dataUri = `data:${mimeType};base64,${base64}`
          images.push(dataUri)
        }
      }

      // 追加 DTO 中传入的 URL
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

      if (images.length > 0) {
        body.images = images
      }
    }

    // 处理参考主体 (参考生视频) → AIFAST 使用 metadata.subjects
    if (taskType === 'reference2video' && dto.subjects) {
      try {
        metadata.subjects = JSON.parse(dto.subjects)
      } catch {
        this.logger.warn('⚠️ Failed to parse subjects JSON')
      }
    }

    // 显式指定 action
    const actionMap: Record<string, string> = {
      'text2video': 'textGenerate',
      'img2video': 'generate',
      'start-end2video': 'firstTailGenerate',
      'reference2video': 'referenceGenerate',
    }
    if (actionMap[taskType]) {
      metadata.action = actionMap[taskType]
    }

    if (Object.keys(metadata).length > 0) {
      body.metadata = metadata
    }

    this.logger.log(`📤 AIFAST Vidu request body: ${JSON.stringify(body).substring(0, 500)}`)

    const response = await axios.post(
      `${config.server}/v1/video/generations`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 120000,
        httpsAgent: this.httpsAgent,
      },
    )

    const data = response.data

    // AIFAST 响应格式 → 标准化
    return {
      id: data.id || data.task_id,
      status: this.mapAifastStatus(data.status),
      model: data.model || dto.model,
      prompt: dto.prompt,
      progress: data.progress || 0,
      duration: dto.duration,
      error: data.error?.message,
      created_at: data.created_at,
      video_url: data.metadata?.url,
      channel: 'aifast',
      raw: data,
    }
  }

  /**
   * 查询 Vidu 视频任务状态
   */
  async queryVideo(taskId: string, userId?: string, channel?: string): Promise<any> {
    if (channel === 'aifast') {
      return this.queryVideoAifast(taskId, userId || 'unknown')
    }
    return this.queryVideoDefault(taskId, userId || 'unknown')
  }

  /**
   * 测试接口官转接口1 - 查询视频
   * GET /api/v1/video/vidu/tasks/:id/creations  （纯数字 int64 ID）
   * GET /api/v1/video/generations/{id}           （字符串 ID，如 img2video 返回的 task_xxx）
   */
  private async queryVideoDefault(taskId: string, userId: string): Promise<any> {
    const config = await this.getUserViduConfig(userId)

    // int64 纯数字 ID 使用 tasks/:id/creations 端点
    // 非数字 ID（如 img2video 返回的 task_xxx）使用 /video/generations/{id} 端点
    const isNumericId = /^\d+$/.test(taskId)
    const queryUrl = isNumericId
      ? `${config.server}/api/v1/video/vidu/tasks/${encodeURIComponent(taskId)}/creations`
      : `${config.server}/api/v1/video/generations/${encodeURIComponent(taskId)}`

    this.logger.log(`📤 [测试接口官转接口1] Querying Vidu task: ${taskId} (${isNumericId ? 'numeric' : 'string'} ID)`)

    const response = await axios.get(
      queryUrl,
      {
        headers: {
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 30000,
        httpsAgent: this.httpsAgent,
      },
    )

    const data = response.data

    // 标准化响应格式
    return {
      id: data.task_id || data.id,
      status: this.mapStatus(data.state),
      model: data.model,
      prompt: data.prompt,
      credits: data.credits,
      video_url: data.result_url,
      error: data.error_msg,
      created_at: data.created_at,
      off_peak: data.off_peak,
      channel: 'default',
      raw: data,
    }
  }

  /**
   * AIFAST站 - 查询视频
   * GET {server}/v1/videos/{task_id}
   */
  private async queryVideoAifast(taskId: string, userId: string): Promise<any> {
    const config = await this.getUserViduConfig(userId)

    this.logger.log(`📤 [AIFAST] Querying Vidu task: ${taskId}`)

    const response = await axios.get(
      `${config.server}/v1/videos/${encodeURIComponent(taskId)}`,
      {
        headers: {
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 30000,
        httpsAgent: this.httpsAgent,
      },
    )

    const data = response.data

    // AIFAST 响应格式 → 标准化
    return {
      id: data.id || data.task_id,
      status: this.mapAifastStatus(data.status),
      model: data.model,
      prompt: data.prompt,
      progress: data.progress || 0,
      video_url: data.metadata?.url,
      error: data.error?.message,
      created_at: data.created_at,
      completed_at: data.completed_at,
      channel: 'aifast',
      raw: data,
    }
  }

  /**
   * 将 Vidu API 状态映射为内部统一状态（测试接口官转接口1）
   */
  private mapStatus(state: string): string {
    switch (state) {
      case 'success':
        return 'completed'
      case 'failed':
        return 'failed'
      case 'created':
      case 'queueing':
        return 'queued'
      case 'processing':
        return 'processing'
      default:
        return state || 'queued'
    }
  }

  /**
   * 将 AIFAST 状态映射为内部统一状态
   */
  private mapAifastStatus(status: string): string {
    switch (status) {
      case 'completed':
        return 'completed'
      case 'failed':
        return 'failed'
      case 'queued':
        return 'queued'
      case 'in_progress':
        return 'processing'
      default:
        return status || 'queued'
    }
  }
}

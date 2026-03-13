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
  async getUserDoubaoConfig(userId: string) {
    try {
      const userConfig = await this.userConfigService.getUserConfig(userId)
      if (userConfig.doubao?.server || userConfig.doubao?.xiaohuminiServer) {
        return userConfig.doubao
      }
    } catch (e) {
      this.logger.warn(`⚠️ Failed to load user config for ${userId}, using global`)
    }
    return this.configService.getDoubaoConfig()
  }

  /**
   * 根据渠道获取对应的 server/key
   * xiaohumini 渠道优先使用 xiaohuminiServer/xiaohuminiKey，回退到 server/key
   */
  getChannelConfig(config: any, channel: string): { server: string; key: string } {
    if (channel === 'xiaohumini') {
      return {
        server: config.xiaohuminiServer || config.server,
        key: config.xiaohuminiKey || config.key,
      }
    }
    return { server: config.server, key: config.key }
  }

  /**
   * 创建豆包视频任务（支持 aifast 和 xiaohumini 渠道）
   */
  async createVideo(
    dto: CreateDoubaoVideoDto,
    firstFrameFile?: Express.Multer.File,
    lastFrameFile?: Express.Multer.File,
    referenceFiles?: Express.Multer.File[],
    userId?: string,
  ): Promise<any> {
    const fullConfig = await this.getUserDoubaoConfig(userId || 'unknown')
    const channel = dto.channel || 'aifast'
    const config = this.getChannelConfig(fullConfig, channel)

    this.logger.log(`📤 Creating Doubao video [${channel}] with model: ${dto.model}`)
    this.logger.log(`📝 Prompt: ${dto.prompt}`)
    this.logger.log(`🔗 Server: ${config.server}`)

    if (channel === 'xiaohumini') {
      return this.createVideoXiaohumini(dto, config, firstFrameFile, lastFrameFile, referenceFiles)
    }

    return this.createVideoAifast(dto, config, firstFrameFile, lastFrameFile)
  }

  /**
   * aifast 渠道创建视频
   * POST {server}/v1/videos (multipart/form-data)
   */
  private async createVideoAifast(
    dto: CreateDoubaoVideoDto,
    config: { server: string; key: string },
    firstFrameFile?: Express.Multer.File,
    lastFrameFile?: Express.Multer.File,
  ): Promise<any> {
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
   * xiaohumini 渠道创建视频
   * POST {server}/volc/v1/contents/generations/tasks (JSON)
   * 参数通过 -- 形式追加到提示词后面
   */
  private async createVideoXiaohumini(
    dto: CreateDoubaoVideoDto,
    config: { server: string; key: string },
    firstFrameFile?: Express.Multer.File,
    lastFrameFile?: Express.Multer.File,
    referenceFiles?: Express.Multer.File[],
  ): Promise<any> {
    // 构建 -- 参数字符串
    const params: string[] = []
    if (dto.resolution) params.push(`--resolution ${dto.resolution}`)
    if (dto.size) params.push(`--ratio ${dto.size}`)
    if (dto.seconds) params.push(`--duration ${dto.seconds}`)
    if (dto.camera_fixed) params.push(`--camera_fixed ${dto.camera_fixed}`)
    if (dto.watermark) params.push(`--watermark ${dto.watermark}`)
    if (dto.seed !== undefined && dto.seed !== null && dto.seed !== -1) params.push(`--seed ${dto.seed}`)

    const fullPrompt = params.length > 0
      ? `${dto.prompt} ${params.join(' ')}`
      : dto.prompt

    const content: any[] = [
      { type: 'text', text: fullPrompt },
    ]

    // 添加首帧图片
    if (firstFrameFile) {
      this.logger.log(`🖼️ Adding first frame image (base64): ${firstFrameFile.originalname}`)
      const base64 = firstFrameFile.buffer.toString('base64')
      const mimeType = firstFrameFile.mimetype || 'image/png'
      content.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64}` },
        role: 'first_frame',
      })
    }

    // 添加尾帧图片
    if (lastFrameFile) {
      this.logger.log(`🖼️ Adding last frame image (base64): ${lastFrameFile.originalname}`)
      const base64 = lastFrameFile.buffer.toString('base64')
      const mimeType = lastFrameFile.mimetype || 'image/png'
      content.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64}` },
        role: 'last_frame',
      })
    }

    // 添加参考图（上传文件转 base64）
    if (referenceFiles && referenceFiles.length > 0) {
      this.logger.log(`🖼️ Adding ${referenceFiles.length} reference images (base64)`)
      for (const file of referenceFiles) {
        const base64 = file.buffer.toString('base64')
        const mimeType = file.mimetype || 'image/png'
        content.push({
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64}` },
          role: 'reference_image',
        })
      }
    }

    // 添加参考图（URL）
    if (dto.images) {
      try {
        const parsed = JSON.parse(dto.images)
        if (Array.isArray(parsed)) {
          for (const url of parsed) {
            content.push({
              type: 'image_url',
              image_url: { url },
              role: 'reference_image',
            })
          }
        }
      } catch {
        const urls = dto.images.split(',').map(s => s.trim()).filter(Boolean)
        for (const url of urls) {
          content.push({
            type: 'image_url',
            image_url: { url },
            role: 'reference_image',
          })
        }
      }
    }

    const body: any = {
      model: dto.model,
      content,
    }

    // generate_audio 仅 Seedance 1.5 pro 支持
    if (dto.generate_audio !== undefined && dto.generate_audio !== '') {
      body.generate_audio = dto.generate_audio === 'true'
    }

    this.logger.log(`📤 Sending xiaohumini create request to: ${config.server}/volc/v1/contents/generations/tasks`)
    this.logger.log(`📦 Request body: ${JSON.stringify(body).slice(0, 500)}`)

    const response = await axios.post(
      `${config.server}/volc/v1/contents/generations/tasks`,
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
   * 查询豆包视频任务状态（支持 aifast 和 xiaohumini 渠道）
   */
  async queryVideo(taskId: string, userId?: string, channel?: string): Promise<any> {
    const fullConfig = await this.getUserDoubaoConfig(userId || 'unknown')
    const ch = channel || 'aifast'
    const config = this.getChannelConfig(fullConfig, ch)

    this.logger.log(`📤 Querying Doubao task [${ch}]: ${taskId}`)

    if (ch === 'xiaohumini') {
      return this.queryVideoXiaohumini(taskId, config)
    }

    return this.queryVideoAifast(taskId, config)
  }

  /**
   * aifast 渠道查询视频
   * GET {server}/v1/videos/{task_id}
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
   * GET {server}/volc/v1/contents/generations/tasks?filter.task_ids=xxx
   * 响应格式 { total, items: [{ id, model, status, content: { video_url }, ... }] }
   */
  private async queryVideoXiaohumini(taskId: string, config: { server: string; key: string }): Promise<any> {
    const response = await axios.get(
      `${config.server}/volc/v1/contents/generations/tasks`,
      {
        params: {
          'filter.task_ids': taskId,
        },
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${config.key}`,
        },
        timeout: 30000,
      },
    )

    const data = response.data

    // 标准化响应格式，与 aifast 渠道统一
    if (data.items && data.items.length > 0) {
      const item = data.items[0]
      let status = item.status
      if (status === 'succeeded') status = 'completed'
      else if (status === 'submitted' || status === 'running') status = 'processing'

      return {
        id: item.id,
        status,
        video_url: item.content?.video_url,
        model: item.model,
        usage: item.usage,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }
    }

    return data
  }
}

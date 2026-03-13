import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as FormData from 'form-data'
import * as https from 'https'
import * as crypto from 'crypto'
import { execSync } from 'child_process'
import { CreateGrokVideoDto } from './dto/create-grok-video.dto'
import { ConfigService } from '../config/config.service'
import { UserConfigService } from '../user-config/user-config.service'
import { FileStorageService } from '../file-storage/file-storage.service'

@Injectable()
export class GrokVideoService {
  private readonly logger = new Logger(GrokVideoService.name)
  private readonly httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    ciphers: 'DEFAULT@SECLEVEL=0',
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
  })

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
  async getUserGrokConfig(userId: string) {
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
    this.logger.log(`🔗 Server: ${config.server}`)

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
        httpsAgent: this.httpsAgent,
      },
    )

    return response.data
  }

  /**
   * xiaohumini 渠道创建视频
   * POST {server}/v1/video/create (JSON)
   * 使用 curl.exe (Schannel TLS) 绕过 Node.js OpenSSL 3.x 与该服务器的 TLS 不兼容问题
   */
  private async createVideoXiaohumini(
    dto: CreateGrokVideoDto,
    files: Express.Multer.File[] | undefined,
    config: { server: string; key: string },
    userId: string,
    baseUrl?: string,
  ): Promise<any> {
    let images: string[] = []

    // 将上传的文件转为 base64 Data URI，避免 localhost URL 无法被远端服务器访问
    if (files && files.length > 0) {
      this.logger.log(`🖼️ Converting ${files.length} uploaded files to base64 data URIs`)
      for (const file of files) {
        const base64 = file.buffer.toString('base64')
        const mimeType = file.mimetype || 'image/png'
        const dataUri = `data:${mimeType};base64,${base64}`
        images.push(dataUri)
        this.logger.log(`📎 File converted: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB) -> data URI`)
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

    return this.httpPost(
      `${config.server}/v1/video/create`,
      body,
      config.key,
    )
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
        httpsAgent: this.httpsAgent,
      },
    )

    return response.data
  }

  /**
   * xiaohumini 渠道查询视频
   * GET {server}/v1/video/query?id={taskId}
   */
  private async queryVideoXiaohumini(taskId: string, config: { server: string; key: string }): Promise<any> {
    const url = `${config.server}/v1/video/query?id=${encodeURIComponent(taskId)}`
    return this.httpGet(url, config.key)
  }

  private readonly isWindows = process.platform === 'win32'

  /**
   * 发送 POST JSON 请求（xiaohumini 渠道）
   * Windows: 用 curl.exe (Schannel TLS) 绕过 OpenSSL 3.x 不兼容
   * Linux/Docker: 直接用 axios
   */
  private async httpPost(url: string, body: any, apiKey: string): Promise<any> {
    if (this.isWindows) {
      return this.curlPost(url, body, apiKey)
    }
    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 120000,
      httpsAgent: this.httpsAgent,
    })
    this.logger.log(`📥 xiaohumini response: ${JSON.stringify(response.data).substring(0, 500)}`)
    return response.data
  }

  /**
   * 发送 GET 请求（xiaohumini 渠道）
   */
  private async httpGet(url: string, apiKey: string): Promise<any> {
    if (this.isWindows) {
      return this.curlGet(url, apiKey)
    }
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 30000,
      httpsAgent: this.httpsAgent,
    })
    this.logger.log(`📥 xiaohumini response: ${JSON.stringify(response.data).substring(0, 500)}`)
    return response.data
  }

  /**
   * Windows: 使用 curl.exe (Schannel TLS) 发送 POST 请求
   */
  private curlPost(url: string, body: any, apiKey: string): any {
    const jsonStr = JSON.stringify(body)
    const fs = require('fs')
    const os = require('os')
    const path = require('path')
    const tmpFile = path.join(os.tmpdir(), `grok_req_${Date.now()}.json`)
    fs.writeFileSync(tmpFile, jsonStr, 'utf-8')

    try {
      const result = execSync(
        `curl.exe -sk -X POST "${url}" -H "Content-Type: application/json" -H "Accept: application/json" -H "Authorization: Bearer ${apiKey}" -d @"${tmpFile}" --max-time 120`,
        { encoding: 'utf-8', timeout: 130000, stdio: ['pipe', 'pipe', 'pipe'] },
      )
      this.logger.log(`📥 xiaohumini curl response: ${result.substring(0, 500)}`)
      return JSON.parse(result)
    } catch (err: any) {
      const stderr = err.stderr?.toString() || ''
      const stdout = err.stdout?.toString() || ''
      this.logger.error(`❌ curl POST failed. stderr: ${stderr}, stdout: ${stdout.substring(0, 300)}`)
      if (stdout.trim()) {
        try { return JSON.parse(stdout) } catch {}
      }
      throw new Error(`curl POST failed: ${stderr || err.message}`)
    } finally {
      try { fs.unlinkSync(tmpFile) } catch {}
    }
  }

  /**
   * Windows: 使用 curl.exe (Schannel TLS) 发送 GET 请求
   */
  private curlGet(url: string, apiKey: string): any {
    try {
      const result = execSync(
        `curl.exe -sk "${url}" -H "Content-Type: application/json" -H "Accept: application/json" -H "Authorization: Bearer ${apiKey}" --max-time 30`,
        { encoding: 'utf-8', timeout: 35000, stdio: ['pipe', 'pipe', 'pipe'] },
      )
      this.logger.log(`📥 xiaohumini curl response: ${result.substring(0, 500)}`)
      return JSON.parse(result)
    } catch (err: any) {
      const stderr = err.stderr?.toString() || ''
      const stdout = err.stdout?.toString() || ''
      this.logger.error(`❌ curl GET failed. stderr: ${stderr}, stdout: ${stdout.substring(0, 300)}`)
      if (stdout.trim()) {
        try { return JSON.parse(stdout) } catch {}
      }
      throw new Error(`curl GET failed: ${stderr || err.message}`)
    }
  }
}

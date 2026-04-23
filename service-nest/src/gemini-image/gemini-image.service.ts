import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { execSync } from 'child_process'
import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { CreateImageDto } from './dto/create-image.dto'
import { ConfigService } from '../config/config.service'
import { DatabaseService } from '../database/database.service'
import { FileStorageService } from '../file-storage/file-storage.service'
import { UserConfigService } from '../user-config/user-config.service'

// 图片任务接口
export interface ImageTask {
  taskId: string
  userId: string
  status: 'processing' | 'completed' | 'failed'
  prompt: string
  model: string
  aspectRatio: string
  imageSize: string
  images?: Array<{
    mimeType: string
    url: string      // 文件 URL 路径（替代 Base64 data）
  }>
  error?: string
  createdAt: number
  /** 提交任务所用的 API 地址 */
  apiServer?: string
  /** 提交任务所用的 API 密钥（脱敏） */
  apiKeyMasked?: string
}

@Injectable()
export class GeminiImageService {
  private readonly logger = new Logger(GeminiImageService.name)
  private readonly isWindows = process.platform === 'win32'
  private readonly safeTmpDir: string

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly fileStorageService: FileStorageService,
    private readonly userConfigService: UserConfigService,
  ) {
    // 初始化安全临时目录（避免 os.tmpdir() 含中文路径在 curl shell 中编码异常）
    this.safeTmpDir = path.join(process.cwd(), 'uploads', 'temp')
    if (!fs.existsSync(this.safeTmpDir)) {
      fs.mkdirSync(this.safeTmpDir, { recursive: true })
    }
    const config = this.configService.getGeminiImageConfig()
    this.logger.log(`🔧 Gemini Image Server: ${config.server}`)
    this.logger.log(`🔑 Gemini Image Key: ${config.key ? `****${config.key.slice(-8)}` : 'NOT SET'}`)
  }

  /**
   * 获取用户级 API 配置（优先用户配置，回退全局配置）
   */
  private async getUserGeminiImageConfig(userId: string) {
    try {
      const userConfig = await this.userConfigService.getUserConfig(userId)
      if (userConfig.geminiImage?.server) {
        return userConfig.geminiImage
      }
    } catch (e) {
      this.logger.warn(`⚠️ Failed to load user config for ${userId}, using global`)
    }
    return this.configService.getGeminiImageConfig()
  }

  private async getUserGrokImageConfig(userId: string) {
    try {
      const userConfig = await this.userConfigService.getUserConfig(userId)
      if (userConfig.grokImage?.server) {
        return userConfig.grokImage
      }
    } catch (e) {
      this.logger.warn(`⚠️ Failed to load user config for ${userId}, using global`)
    }
    const globalCfg = this.configService.getGrokImageConfig()
    return { ...globalCfg, channel: 'aifast' }
  }

  /**
   * 获取用户的 Grok Image 渠道（优先 DTO，其次用户配置，默认 aifast）
   */
  private async resolveGrokImageChannel(dto: CreateImageDto, userId: string): Promise<string> {
    if (dto.channel) return dto.channel
    try {
      const userConfig = await this.userConfigService.getUserConfig(userId)
      return userConfig.grokImage?.channel || 'aifast'
    } catch {
      return 'aifast'
    }
  }

  /**
   * 创建 HTTP 客户端（Gemini，使用用户配置）
   */
  private createHttpClientWithConfig(config: { server: string; key: string }) {
    return axios.create({
      baseURL: config.server,
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${config.key}`,
      },
    })
  }

  /**
   * 创建 HTTP 客户端（Grok/OpenAI 兼容，使用用户配置）
   */
  private createGrokHttpClientWithConfig(config: { server: string; key: string }) {
    return axios.create({
      baseURL: config.server,
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${config.key}`,
      },
    })
  }

  /**
   * 判断是否为 Grok/OpenAI 图片模型
   */
  private isGrokImageModel(model: string): boolean {
    return model.startsWith('grok-') && model.includes('image')
      || model.startsWith('gpt-image')
  }

  /**
   * 判断是否为 GPT 图片模型（gpt-image-* 系列）
   */
  private isGptImageModel(model: string): boolean {
    return model.startsWith('gpt-image')
  }

  /**
   * 压测专用：调用上游 API 生成图片，不保存到磁盘/数据库
   * 返回 { success, latencyMs, error? }
   */
  async stressTestGenerate(dto: CreateImageDto, userId: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const model = dto.model || 'gemini-3-pro-image-preview'
    const start = Date.now()
    try {
      if (this.isGrokImageModel(model)) {
        await this.callGrokImageApi(dto, userId)
      } else {
        await this.callGeminiImageApi(dto, userId)
      }
      return { success: true, latencyMs: Date.now() - start }
    } catch (error: any) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: error.response?.data?.error?.message || error.message,
      }
    }
  }

  /**
   * 创建图片生成任务
   */
  async createImage(dto: CreateImageDto, userId: string): Promise<{ id: string; status: string }> {
    const taskId = randomUUID()
    const model = dto.model || 'gemini-3-pro-image-preview'
    const aspectRatio = dto.aspectRatio || '1:1'
    const imageSize = dto.imageSize || '1K'

    // 创建任务记录到 MongoDB
    const task: ImageTask = {
      taskId,
      userId,
      status: 'processing',
      prompt: dto.prompt,
      model,
      aspectRatio,
      imageSize,
      createdAt: Date.now(),
    }
    await this.saveTask(task)

    this.logger.log(`📤 Creating image task: ${taskId} for userId: ${userId}`)
    this.logger.log(`📝 Prompt: ${dto.prompt}`)
    this.logger.log(`📐 Aspect Ratio: ${aspectRatio}, Size: ${imageSize}`)

    // 异步处理图片生成
    this.processImageGeneration(taskId, dto, userId).catch((error) => {
      this.logger.error(`❌ Image generation failed: ${error.message}`)
    })

    return { id: taskId, status: 'processing' }
  }

  /**
   * 异步处理图片生成
   */
  private async processImageGeneration(taskId: string, dto: CreateImageDto, userId: string): Promise<void> {
    const task = await this.getTask(taskId)
    if (!task) return

    try {
      const model = dto.model || 'gemini-3-pro-image-preview'

      // 记录当前使用的 API 配置
      if (this.isGrokImageModel(model)) {
        const cfg = await this.getUserGrokImageConfig(userId)
        task.apiServer = cfg.server
        task.apiKeyMasked = cfg.key ? cfg.key.slice(0, 6) + '****' + cfg.key.slice(-4) : ''
      } else {
        const cfg = await this.getUserGeminiImageConfig(userId)
        task.apiServer = cfg.server
        task.apiKeyMasked = cfg.key ? cfg.key.slice(0, 6) + '****' + cfg.key.slice(-4) : ''
      }

      let rawImages: Array<{ mimeType: string; data: string }>

      if (this.isGrokImageModel(model)) {
        rawImages = await this.callGrokImageApi(dto, userId)
      } else {
        rawImages = await this.callGeminiImageApi(dto, userId)
      }

      if (rawImages.length > 0) {
        const savedImages = this.fileStorageService.saveBase64Images(userId, rawImages, taskId)
        task.status = 'completed'
        task.images = savedImages
        this.logger.log(`✅ Task ${taskId} completed with ${savedImages.length} image(s) saved to disk`)
      } else {
        task.status = 'failed'
        task.error = 'No images generated'
        this.logger.warn(`⚠️ Task ${taskId} completed but no images found`)
      }
    } catch (error: any) {
      task.status = 'failed'
      task.error = error.response?.data?.error?.message || error.message
      this.logger.error(`❌ Task ${taskId} failed: ${task.error}`)
    }

    await this.saveTask(task)
  }

  /**
   * 调用 Gemini API 生成图片
   */
  private async callGeminiImageApi(dto: CreateImageDto, userId: string): Promise<Array<{ mimeType: string; data: string }>> {
    const model = dto.model || 'gemini-3-pro-image-preview'
    const aspectRatio = dto.aspectRatio || '1:1'
    const imageSize = dto.imageSize || '1K'

    const parts: any[] = [{ text: dto.prompt }]

    if (dto.referenceImages && dto.referenceImages.length > 0) {
      for (const img of dto.referenceImages) {
        parts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: img.data,
          },
        })
      }
    }

    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio, imageSize },
      },
    }

    this.logger.log(`📤 Sending request to Gemini API, model: ${model}`)
    const geminiConfig = await this.getUserGeminiImageConfig(userId)
    const httpClient = this.createHttpClientWithConfig(geminiConfig)
    const response = await httpClient.post(`/v1beta/models/${model}:generateContent`, payload)
    this.logger.log(`✅ Gemini API response received`)

    const images = this.extractImages(response.data)
    if (images.length === 0) {
      this.logGeminiNoImageDiagnostics(response.data, model, dto.prompt)
    }

    return images
  }

  /**
   * 调用 Grok/OpenAI 兼容图片 API（根据渠道分发）
   */
  private async callGrokImageApi(dto: CreateImageDto, userId: string): Promise<Array<{ mimeType: string; data: string }>> {
    const channel = await this.resolveGrokImageChannel(dto, userId)
    this.logger.log(`🔀 Grok Image channel: ${channel}`)

    if (channel === 'xiaohumini') {
      return this.callGrokImageXiaohumini(dto, userId)
    }
    return this.callGrokImageAifast(dto, userId)
  }

  /**
   * aifast 渠道：Grok/OpenAI 兼容图片 API
   * 请求格式: { model, size, n, prompt, response_format: 'b64_json', image? }
   * 响应格式: { data: [{ b64_json }] }
   */
  private async callGrokImageAifast(dto: CreateImageDto, userId: string): Promise<Array<{ mimeType: string; data: string }>> {
    const model = dto.model || 'grok-4-1-image'
    const size = dto.size || '1024x1024'
    const n = dto.n || 1

    // GPT 模型带参考图时走图片编辑接口 /v1/images/edits
    if (this.isGptImageModel(model) && dto.referenceImages && dto.referenceImages.length > 0) {
      const grokConfig = await this.getUserGrokImageConfig(userId)
      return this.callGptImageEditAifast(dto, grokConfig)
    }

    const payload: any = {
      model,
      size,
      n,
      prompt: dto.prompt,
      response_format: 'b64_json',
    }

    // 如果有参考图片（垫图），转为 base64 URL 数组（Grok 模型）
    if (dto.referenceImages && dto.referenceImages.length > 0) {
      payload.image = dto.referenceImages.map(
        img => `data:${img.mimeType};base64,${img.data}`,
      )
    }

    this.logger.log(`📤 Sending request to Grok Image API, model: ${model}, size: ${size}, n: ${n}`)
    const grokConfig = await this.getUserGrokImageConfig(userId)
    this.logger.log(`🔧 Grok Image Server: ${grokConfig.server}`)
    const httpClient = this.createGrokHttpClientWithConfig(grokConfig)

    // 先尝试一次请求，如果 API 服务商不支持 n 参数（只返回 1 张），则并发补发剩余请求
    const response = await httpClient.post('/v1/images/generations', payload)
    this.logger.log(`✅ Grok Image API response received`)

    const firstBatch = this.extractGrokImages(response.data)

    if (n > 1 && firstBatch.length < n) {
      this.logger.log(`⚠️ API returned ${firstBatch.length}/${n} images, sending ${n - firstBatch.length} parallel requests`)
      const remaining = n - firstBatch.length
      const singlePayload = { ...payload, n: 1 }
      const promises = Array.from({ length: remaining }, () =>
        httpClient.post('/v1/images/generations', singlePayload)
          .then(r => this.extractGrokImages(r.data))
          .catch(err => {
            this.logger.warn(`⚠️ Parallel request failed: ${err.message}`)
            return [] as Array<{ mimeType: string; data: string }>
          }),
      )
      const extraResults = await Promise.all(promises)
      for (const imgs of extraResults) {
        firstBatch.push(...imgs)
      }
      this.logger.log(`✅ Total images collected: ${firstBatch.length}`)
    }

    return firstBatch
  }

  /**
   * GPT 图片编辑：使用 /v1/images/edits (multipart/form-data)
   * 文档：https://platform.openai.com/docs/api-reference/images/createEdit
   * 请求：image(file), prompt, model, n, size, response_format
   * 响应：{ data: [{ b64_json?, url? }] }
   */
  private async callGptImageEditAifast(
    dto: CreateImageDto,
    config: { server: string; key: string },
  ): Promise<Array<{ mimeType: string; data: string }>> {
    const model = dto.model || 'gpt-image-2'
    const size = dto.size || '1024x1024'
    const n = dto.n || 1
    const refImage = dto.referenceImages![0]

    this.logger.log(`📤 Sending GPT image edit request, model: ${model}, size: ${size}, n: ${n}`)

    const url = `${config.server}/v1/images/edits`

    if (this.isWindows) {
      // Windows: 使用 curl.exe 发送 multipart/form-data（临时文件放项目目录避免中文路径问题）
      const ts = Date.now()
      const imgFile = path.join(this.safeTmpDir, `gpt_edit_${ts}.png`)
      const promptFile = path.join(this.safeTmpDir, `gpt_prompt_${ts}.txt`)
      fs.writeFileSync(imgFile, Buffer.from(refImage.data, 'base64'))
      fs.writeFileSync(promptFile, dto.prompt, 'utf-8')

      try {
        const result = execSync(
          `curl.exe -sk -X POST "${url}" -H "Authorization: Bearer ${config.key}" -F "model=${model}" -F "n=${n}" -F "size=${size}" -F "prompt=<${promptFile}" -F "image=@${imgFile}" --max-time 180`,
          { encoding: 'utf-8', timeout: 190000, stdio: ['pipe', 'pipe', 'pipe'] },
        )
        this.logger.log(`📥 GPT image edit curl response: ${result.substring(0, 500)}`)
        const parsed = JSON.parse(result)
        const images = this.extractGrokImages(parsed)
        // 若 URL 模式则下载转 base64
        return await this.resolveGrokImageResults(parsed, images)
      } catch (err: any) {
        const stderr = err.stderr?.toString() || ''
        const stdout = err.stdout?.toString() || ''
        this.logger.error(`❌ curl GPT edit POST failed. stderr: ${stderr}, stdout: ${stdout.substring(0, 300)}`)
        if (stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout)
            return await this.resolveGrokImageResults(parsed, this.extractGrokImages(parsed))
          } catch {}
        }
        throw new Error(`curl GPT edit POST failed: ${stderr || err.message}`)
      } finally {
        try { fs.unlinkSync(imgFile) } catch {}
        try { fs.unlinkSync(promptFile) } catch {}
      }
    }

    // Linux/Docker: 使用 axios + form-data
    const FormData = require('form-data')
    const form = new FormData()
    form.append('model', model)
    form.append('prompt', dto.prompt)
    form.append('n', String(n))
    form.append('size', size)
    form.append('image', Buffer.from(refImage.data, 'base64'), {
      filename: 'image.png',
      contentType: refImage.mimeType || 'image/png',
    })

    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${config.key}`,
      },
      timeout: 180000,
    })
    this.logger.log(`📥 GPT image edit response received`)
    return await this.resolveGrokImageResults(response.data, this.extractGrokImages(response.data))
  }

  /**
   * 解析 Grok/GPT 图片响应：b64_json 直接使用，url 则下载转 base64
   */
  private async resolveGrokImageResults(
    responseData: any,
    extractedImages: Array<{ mimeType: string; data: string }>,
  ): Promise<Array<{ mimeType: string; data: string }>> {
    const result: Array<{ mimeType: string; data: string }> = [...extractedImages]
    try {
      const dataList = responseData?.data || []
      for (const item of dataList) {
        if (!item.b64_json && item.url) {
          const downloaded = await this.downloadImageToBase64(item.url)
          if (downloaded) result.push(downloaded)
        }
      }
    } catch {}
    return result
  }

  /**
   * 从 Grok/OpenAI 图片响应中提取图片
   * 响应格式: { data: [{ b64_json?, url?, revised_prompt? }] }
   */
  private extractGrokImages(responseData: any): Array<{ mimeType: string; data: string }> {
    const images: Array<{ mimeType: string; data: string }> = []

    try {
      const dataList = responseData?.data || []
      for (const item of dataList) {
        if (item.b64_json) {
          images.push({
            mimeType: 'image/png',
            data: item.b64_json,
          })
        } else if (item.url) {
          // URL 模式暂不处理，记录日志
          this.logger.log(`📎 Grok returned image URL: ${item.url}`)
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error extracting Grok images: ${error}`)
    }

    return images
  }

  /**
   * xiaohumini 渠道：Grok 图片生成
   * POST {server}/v1/images/generations (JSON)
   * 请求格式: { model, prompt, size }
   * 响应格式: { data: [{ url }] }
   */
  private async callGrokImageXiaohumini(dto: CreateImageDto, userId: string): Promise<Array<{ mimeType: string; data: string }>> {
    const model = dto.model || 'grok-3-image'
    const size = dto.size || '960x960'

    const grokConfig = await this.getUserGrokImageConfig(userId)
    this.logger.log(`🔧 Grok Image Server [xiaohumini]: ${grokConfig.server}`)

    // xiaohumini 有参考图时走编辑接口 /v1/images/edits
    if (dto.referenceImages && dto.referenceImages.length > 0) {
      return this.callGrokImageEditXiaohumini(dto, grokConfig)
    }

    const payload: any = {
      model,
      prompt: dto.prompt,
      size,
    }

    this.logger.log(`📤 Sending request to xiaohumini Grok Image API, model: ${model}, size: ${size}`)

    const responseData = await this.httpPost(
      `${grokConfig.server}/v1/images/generations`,
      payload,
      grokConfig.key,
    )
    this.logger.log(`✅ xiaohumini Grok Image API response received`)

    return this.extractGrokImageUrls(responseData)
  }

  /**
   * xiaohumini 渠道：Grok 图片编辑
   * POST {server}/v1/images/edits (multipart/form-data)
   * 请求: model, prompt, image (file)
   * 响应: { data: [{ url }] }
   */
  private async callGrokImageEditXiaohumini(
    dto: CreateImageDto,
    config: { server: string; key: string },
  ): Promise<Array<{ mimeType: string; data: string }>> {
    const model = dto.model || 'grok-3-image'
    const refImage = dto.referenceImages![0]

    this.logger.log(`📤 Sending edit request to xiaohumini, model: ${model}`)

    const url = `${config.server}/v1/images/edits`

    if (this.isWindows) {
      // Windows: 使用 curl.exe 发送 multipart/form-data（临时文件放在项目目录避免中文路径问题）
      const ts = Date.now()
      const imgFile = path.join(this.safeTmpDir, `grok_edit_${ts}.png`)
      const promptFile = path.join(this.safeTmpDir, `grok_prompt_${ts}.txt`)
      fs.writeFileSync(imgFile, Buffer.from(refImage.data, 'base64'))
      fs.writeFileSync(promptFile, dto.prompt, 'utf-8')

      try {
        const result = execSync(
          `curl.exe -sk -X POST "${url}" -H "Authorization: Bearer ${config.key}" -F "model=${model}" -F "prompt=<${promptFile}" -F "image=@${imgFile}" --max-time 120`,
          { encoding: 'utf-8', timeout: 130000, stdio: ['pipe', 'pipe', 'pipe'] },
        )
        this.logger.log(`📥 xiaohumini edit curl response: ${result.substring(0, 500)}`)
        return this.extractGrokImageUrls(JSON.parse(result))
      } catch (err: any) {
        const stderr = err.stderr?.toString() || ''
        const stdout = err.stdout?.toString() || ''
        this.logger.error(`❌ curl edit POST failed. stderr: ${stderr}, stdout: ${stdout.substring(0, 300)}`)
        if (stdout.trim()) {
          try { return this.extractGrokImageUrls(JSON.parse(stdout)) } catch {}
        }
        throw new Error(`curl edit POST failed: ${stderr || err.message}`)
      } finally {
        try { fs.unlinkSync(imgFile) } catch {}
        try { fs.unlinkSync(promptFile) } catch {}
      }
    }

    // Linux/Docker: 使用 axios multipart
    const FormData = require('form-data')
    const form = new FormData()
    form.append('model', model)
    form.append('prompt', dto.prompt)
    form.append('image', Buffer.from(refImage.data, 'base64'), {
      filename: 'image.png',
      contentType: refImage.mimeType || 'image/png',
    })

    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${config.key}`,
      },
      timeout: 120000,
    })
    this.logger.log(`📥 xiaohumini edit response received`)
    return this.extractGrokImageUrls(response.data)
  }

  /**
   * 从 xiaohumini Grok 响应中提取图片 URL 并下载转为 base64
   * 响应格式: { data: [{ url }] }
   */
  private async extractGrokImageUrls(responseData: any): Promise<Array<{ mimeType: string; data: string }>> {
    const images: Array<{ mimeType: string; data: string }> = []

    try {
      const dataList = responseData?.data || []
      for (const item of dataList) {
        if (item.url) {
          this.logger.log(`📎 xiaohumini returned image URL: ${item.url}`)
          const downloaded = await this.downloadImageToBase64(item.url)
          if (downloaded) {
            images.push(downloaded)
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error extracting xiaohumini images: ${error}`)
    }

    return images
  }

  /**
   * 下载图片 URL 并转为 base64
   */
  private async downloadImageToBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
      })
      const buffer = Buffer.from(response.data)
      const contentType = response.headers['content-type'] || 'image/jpeg'
      this.logger.log(`📥 Downloaded image: ${(buffer.length / 1024).toFixed(1)} KB, type: ${contentType}`)
      return {
        mimeType: contentType,
        data: buffer.toString('base64'),
      }
    } catch (error: any) {
      this.logger.error(`❌ Failed to download image from ${url}: ${error.message}`)
      return null
    }
  }

  // ===== xiaohumini HTTP 工具方法 =====

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
    })
    this.logger.log(`📥 xiaohumini response: ${JSON.stringify(response.data).substring(0, 500)}`)
    return response.data
  }

  /**
   * Windows: 使用 curl.exe (Schannel TLS) 发送 POST 请求
   */
  private curlPost(url: string, body: any, apiKey: string): any {
    const jsonStr = JSON.stringify(body)
    const tmpFile = path.join(this.safeTmpDir, `grok_img_req_${Date.now()}.json`)
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
   * 从 Gemini 响应中提取图片
   * 支持两种格式：inlineData（驼峰）和 inline_data（下划线）
   */
  private extractImages(responseData: any): Array<{ mimeType: string; data: string }> {
    const images: Array<{ mimeType: string; data: string }> = []

    try {
      const candidates = responseData?.candidates || []
      for (const candidate of candidates) {
        const content = candidate?.content
        if (content?.parts) {
          for (const part of content.parts) {
            // 支持驼峰命名 (inlineData) 和下划线命名 (inline_data)
            const inlineData = part.inlineData || part.inline_data
            if (inlineData) {
              images.push({
                mimeType: inlineData.mimeType || inlineData.mime_type,
                data: inlineData.data,
              })
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error extracting images: ${error}`)
    }

    return images
  }

  /**
   * 0 图场景下输出 Gemini 响应诊断信息（阻断原因 + 候选摘要）
   */
  private logGeminiNoImageDiagnostics(responseData: any, model: string, prompt: string): void {
    try {
      const promptFeedback = responseData?.promptFeedback || {}
      const blockReason = promptFeedback?.blockReason || promptFeedback?.block_reason || 'UNKNOWN'
      const safetyRatings = promptFeedback?.safetyRatings || promptFeedback?.safety_ratings || []

      const candidateSummaries = (responseData?.candidates || []).map((candidate: any, index: number) => {
        const finishReason = candidate?.finishReason || candidate?.finish_reason || 'UNKNOWN'
        const parts = candidate?.content?.parts || []

        const partSummary = parts.slice(0, 5).map((part: any) => {
          const inlineData = part?.inlineData || part?.inline_data
          if (inlineData?.data) {
            return '[IMAGE]'
          }
          if (typeof part?.text === 'string') {
            const text = part.text.replace(/\s+/g, ' ').trim()
            return text ? `[TEXT] ${text.slice(0, 120)}` : '[TEXT]'
          }
          return '[OTHER]'
        })

        return {
          index,
          finishReason,
          partCount: parts.length,
          parts: partSummary,
        }
      })

      this.logger.warn(`⚠️ Gemini returned 0 images. model=${model}`)
      this.logger.warn(`⚠️ Prompt preview: ${prompt?.slice(0, 100) || ''}`)
      this.logger.warn(`⚠️ Prompt feedback: ${JSON.stringify({ blockReason, safetyRatings })}`)
      this.logger.warn(`⚠️ Candidate summary: ${JSON.stringify(candidateSummaries)}`)
    } catch (error: any) {
      this.logger.warn(`⚠️ Failed to log Gemini no-image diagnostics: ${error?.message || error}`)
    }
  }

  /**
   * 查询图片任务状态
   */
  async queryImage(taskId: string): Promise<any> {
    this.logger.log(`🔍 Querying image task: ${taskId}`)

    const task = await this.getTask(taskId)
    if (!task) {
      return {
        id: taskId,
        status: 'not_found',
        error: 'Task not found',
      }
    }

    const result: any = {
      id: task.taskId,
      status: task.status,
      prompt: task.prompt,
      model: task.model,
      aspectRatio: task.aspectRatio,
      imageSize: task.imageSize,
      username: task.userId,
      createdAt: task.createdAt,
    }

    if (task.status === 'completed' && task.images) {
      // 返回文件 URL（不再是 Base64）
      result.images = task.images
    }

    if (task.status === 'failed' && task.error) {
      result.error = task.error
    }

    return result
  }

  /**
   * 直接生成图片（同步方式，返回完整结果）
   */
  async generateImageSync(dto: CreateImageDto, userId: string): Promise<any> {
    const taskId = randomUUID()
    const model = dto.model || 'gemini-3-pro-image-preview'

    this.logger.log(`📤 Generating image synchronously for userId: ${userId}`)
    this.logger.log(`📝 Prompt: ${dto.prompt}`)
    this.logger.log(`🤖 Model: ${model}`)

    let rawImages: Array<{ mimeType: string; data: string }>

    if (this.isGrokImageModel(model)) {
      rawImages = await this.callGrokImageApi(dto, userId)
    } else {
      rawImages = await this.callGeminiImageApi(dto, userId)
    }

    // 将 Base64 图片保存为文件
    const savedImages = rawImages.length > 0
      ? this.fileStorageService.saveBase64Images(userId, rawImages, taskId)
      : []

    const status = savedImages.length > 0 ? 'completed' : 'failed'

    // 获取当前使用的 API 配置
    let apiServer = ''
    let apiKeyMasked = ''
    if (this.isGrokImageModel(model)) {
      const cfg = await this.getUserGrokImageConfig(userId)
      apiServer = cfg.server
      apiKeyMasked = cfg.key ? cfg.key.slice(0, 6) + '****' + cfg.key.slice(-4) : ''
    } else {
      const cfg = await this.getUserGeminiImageConfig(userId)
      apiServer = cfg.server
      apiKeyMasked = cfg.key ? cfg.key.slice(0, 6) + '****' + cfg.key.slice(-4) : ''
    }

    // 同步模式也记录到 MongoDB image_tasks
    const task: ImageTask = {
      taskId,
      userId,
      status: status as 'completed' | 'failed',
      prompt: dto.prompt || '',
      model,
      aspectRatio: dto.aspectRatio || dto.size || '1:1',
      imageSize: dto.imageSize || dto.size || '1K',
      images: savedImages.length > 0 ? savedImages : undefined,
      error: savedImages.length === 0 ? 'No images generated' : undefined,
      createdAt: Date.now(),
      apiServer,
      apiKeyMasked,
    }
    await this.saveTask(task)
    this.logger.log(`📝 Sync task ${taskId} saved to MongoDB (${status})`)

    return {
      id: taskId,
      status,
      images: savedImages,
    }
  }

  // ===== MongoDB 存储方法 =====

  /**
   * 保存任务到 MongoDB
   */
  private async saveTask(task: ImageTask): Promise<void> {
    const collection = this.databaseService.getDb().collection('image_tasks')
    await collection.updateOne(
      { taskId: task.taskId },
      { $set: task as any },
      { upsert: true },
    )
  }

  /**
   * 从 MongoDB 获取任务
   */
  private async getTask(taskId: string): Promise<ImageTask | null> {
    const collection = this.databaseService.getDb().collection('image_tasks')
    const doc = await collection.findOne({ taskId }) as any
    if (!doc) return null
    return {
      taskId: doc.taskId,
      userId: doc.userId || doc.username || 'unknown',
      status: doc.status,
      prompt: doc.prompt,
      model: doc.model,
      aspectRatio: doc.aspectRatio,
      imageSize: doc.imageSize,
      images: doc.images,
      error: doc.error,
      createdAt: doc.createdAt,
      apiServer: doc.apiServer,
      apiKeyMasked: doc.apiKeyMasked,
    }
  }

  /**
   * 获取用户的图片任务列表
   */
  async getUserTasks(userId: string, options?: { page?: number; limit?: number; status?: string }): Promise<{
    tasks: ImageTask[]
    total: number
    page: number
    limit: number
  }> {
    const collection = this.databaseService.getDb().collection('image_tasks')
    const page = options?.page || 1
    const limit = options?.limit || 20
    const skip = (page - 1) * limit

    const query: any = { userId }
    if (options?.status) {
      query.status = options.status
    }

    const [tasks, total] = await Promise.all([
      collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query),
    ])

    return {
      tasks: tasks.map((doc: any) => ({
        taskId: doc.taskId,
        userId: doc.userId,
        status: doc.status,
        prompt: doc.prompt,
        model: doc.model,
        aspectRatio: doc.aspectRatio,
        imageSize: doc.imageSize,
        images: doc.images,
        error: doc.error,
        createdAt: doc.createdAt,
      })),
      total,
      page,
      limit,
    }
  }
}

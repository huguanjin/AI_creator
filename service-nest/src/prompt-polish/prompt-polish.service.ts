import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '../config/config.service'
import { UserConfigService } from '../user-config/user-config.service'
import axios from 'axios'

@Injectable()
export class PromptPolishService {
  private readonly logger = new Logger(PromptPolishService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly userConfigService: UserConfigService,
  ) {
    const config = this.configService.getPromptPolishConfig()
    this.logger.log(`🔧 Prompt Polish Server: ${config.server || 'NOT SET'}`)
    this.logger.log(`🔑 Prompt Polish Key: ${config.key ? `****${config.key.slice(-8)}` : 'NOT SET'}`)
  }

  /**
   * 获取用户级 API 配置（优先用户配置，回退全局配置）
   */
  private async getUserPromptPolishConfig(userId: string) {
    try {
      const userConfig = await this.userConfigService.getUserConfig(userId)
      if (userConfig.promptPolish?.server) {
        return userConfig.promptPolish
      }
    } catch (e) {
      this.logger.warn(`⚠️ Failed to load user config for ${userId}, using global`)
    }
    return this.configService.getPromptPolishConfig()
  }

  /**
   * 获取润色系统提示词（从全局配置中获取）
   */
  private getSystemPrompt(): string {
    const config = this.configService.getPromptPolishConfig()
    return config.systemPrompt || `你是一个专业的AI绘画提示词优化专家。用户会给你一个简单的图片描述，请你将其优化为更详细、更专业的AI绘画提示词。

优化规则：
1. 保持用户原始意图不变
2. 添加更多细节描述（光影、材质、风格、氛围等）
3. 使用英文输出，因为大多数AI绘画模型对英文效果更好
4. 如果用户输入是中文，先理解含义，然后输出英文提示词
5. 提示词长度适中，不要过长
6. 直接输出优化后的提示词，不要有任何解释或额外内容`
  }

  /**
   * 润色提示词（SSE 流式）
   * 返回一个 async generator，用于流式输出
   */
  async *polishPromptStream(
    prompt: string,
    model: string,
    userId: string,
  ): AsyncGenerator<string, void, unknown> {
    const config = await this.getUserPromptPolishConfig(userId)

    if (!config.server || !config.key) {
      yield JSON.stringify({ error: '提示词润色服务未配置，请联系管理员' })
      return
    }

    const systemPrompt = this.getSystemPrompt()

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
        role: 'user',
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
      ],
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        thinkingConfig: {
          includeThoughts: false,
        },
      },
    }

    this.logger.log(`📤 Polishing prompt with model: ${model}`)
    this.logger.log(`📝 Original prompt: ${prompt.slice(0, 100)}...`)

    try {
      const url = `${config.server}/v1beta/models/${model}:streamGenerateContent?alt=sse`
      
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.key,
        },
        responseType: 'stream',
        timeout: 60000,
      })

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim()
            if (jsonStr && jsonStr !== '[DONE]') {
              try {
                const data = JSON.parse(jsonStr)
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
                if (text) {
                  yield JSON.stringify({ text })
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }

      yield JSON.stringify({ done: true })
      this.logger.log(`✅ Prompt polish completed`)
    } catch (error: any) {
      this.logger.error(`❌ Prompt polish failed: ${error.message}`)
      yield JSON.stringify({ error: error.response?.data?.error?.message || error.message })
    }
  }

  /**
   * 润色提示词（非流式，返回完整结果）
   */
  async polishPrompt(prompt: string, model: string, userId: string): Promise<string> {
    const config = await this.getUserPromptPolishConfig(userId)

    if (!config.server || !config.key) {
      throw new Error('提示词润色服务未配置，请联系管理员')
    }

    const systemPrompt = this.getSystemPrompt()

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
        role: 'user',
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
      ],
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
      },
    }

    this.logger.log(`📤 Polishing prompt (sync) with model: ${model}`)

    const url = `${config.server}/v1beta/models/${model}:generateContent`
    
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.key,
      },
      timeout: 60000,
    })

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error('润色结果为空')
    }

    this.logger.log(`✅ Prompt polish completed (sync)`)
    return text
  }
}

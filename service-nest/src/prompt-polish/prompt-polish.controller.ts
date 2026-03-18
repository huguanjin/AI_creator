import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PromptPolishService } from './prompt-polish.service'
import { PolishPromptDto } from './polish-prompt.dto'
import { Response } from 'express'

@Controller('v1/prompt-polish')
export class PromptPolishController {
  constructor(private readonly promptPolishService: PromptPolishService) {}

  /**
   * 润色提示词（SSE 流式响应）
   */
  @Post('stream')
  @UseGuards(JwtAuthGuard)
  async polishStream(
    @Body() dto: PolishPromptDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req.user?.userId || 'anonymous'
    const model = dto.model || 'gemini-2.5-flash'

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    try {
      for await (const chunk of this.promptPolishService.polishPromptStream(
        dto.prompt,
        model,
        userId,
      )) {
        res.write(`data: ${chunk}\n\n`)
      }
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
    }

    res.end()
  }

  /**
   * 润色提示词（非流式，返回完整结果）
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async polish(@Body() dto: PolishPromptDto, @Req() req: any) {
    const userId = req.user?.userId || 'anonymous'
    const model = dto.model || 'gemini-2.5-flash'

    try {
      const result = await this.promptPolishService.polishPrompt(
        dto.prompt,
        model,
        userId,
      )
      return { status: 'success', data: { polishedPrompt: result } }
    } catch (error: any) {
      return { status: 'error', message: error.message }
    }
  }
}

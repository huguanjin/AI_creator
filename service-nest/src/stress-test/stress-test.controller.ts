import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Request } from 'express'
import { StressTestService } from './stress-test.service'
import { StartStressTestDto } from './dto/start-stress-test.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('v1/stress-test')
@UseGuards(JwtAuthGuard)
export class StressTestController {
  private readonly logger = new Logger(StressTestController.name)

  constructor(private readonly stressTestService: StressTestService) {}

  /**
   * 启动压测
   * POST /v1/stress-test/start
   */
  @Post('start')
  async startTest(@Body() dto: StartStressTestDto, @Req() req: Request) {
    const userId = (req as any).user?.userId || 'anonymous'
    this.logger.log(`⚡ Starting stress test: model=${dto.model}, rpm=${dto.rpm}, total=${dto.totalRequests || 'unlimited'}, userId=${userId}`)

    try {
      const result = await this.stressTestService.startTest(dto, userId)
      return { status: 'ok', data: result }
    } catch (error: any) {
      throw new HttpException(
        { status: 'error', message: error.message },
        HttpStatus.BAD_REQUEST,
      )
    }
  }

  /**
   * 停止压测
   * POST /v1/stress-test/stop/:sessionId
   */
  @Post('stop/:sessionId')
  async stopTest(@Param('sessionId') sessionId: string, @Req() req: Request) {
    const userId = (req as any).user?.userId || 'anonymous'
    this.logger.log(`⏹ Stopping stress test: ${sessionId}, userId=${userId}`)

    try {
      const result = await this.stressTestService.stopTest(sessionId, userId)
      return { status: 'ok', data: result }
    } catch (error: any) {
      throw new HttpException(
        { status: 'error', message: error.message },
        HttpStatus.BAD_REQUEST,
      )
    }
  }

  /**
   * 获取压测状态
   * GET /v1/stress-test/status/:sessionId
   */
  @Get('status/:sessionId')
  async getStatus(@Param('sessionId') sessionId: string, @Req() req: Request) {
    const userId = (req as any).user?.userId || 'anonymous'

    try {
      const result = await this.stressTestService.getStatus(sessionId, userId)
      return { status: 'ok', data: result }
    } catch (error: any) {
      throw new HttpException(
        { status: 'error', message: error.message },
        HttpStatus.NOT_FOUND,
      )
    }
  }

  /**
   * 获取历史压测记录
   * GET /v1/stress-test/history
   */
  @Get('history')
  async getHistory(@Req() req: Request) {
    const userId = (req as any).user?.userId || 'anonymous'

    try {
      const result = await this.stressTestService.getHistory(userId)
      return { status: 'ok', data: result }
    } catch (error: any) {
      throw new HttpException(
        { status: 'error', message: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}

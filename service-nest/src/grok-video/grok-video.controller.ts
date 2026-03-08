import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { GrokVideoService } from './grok-video.service'
import { CreateGrokVideoDto } from './dto/create-grok-video.dto'
import { QueryGrokVideoDto } from './dto/query-grok-video.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { VideoTasksService } from '../video-tasks/video-tasks.service'

@Controller('v1/grok')
@UseGuards(JwtAuthGuard)
export class GrokVideoController {
  private readonly logger = new Logger(GrokVideoController.name)

  constructor(
    private readonly grokVideoService: GrokVideoService,
    private readonly videoTasksService: VideoTasksService,
  ) {}

  /**
   * 创建 Grok 视频
   * POST /v1/grok/create
   * 支持 multipart/form-data 上传参考图
   */
  @Post('create')
  @UseInterceptors(FilesInterceptor('input_reference', 10))
  async createVideo(
    @Body() createVideoDto: CreateGrokVideoDto,
    @UploadedFiles() files?: Express.Multer.File[],
    @Req() req?: any,
  ) {
    const userId = req?.user?.userId || 'unknown'
    this.logger.log(`📹 Creating Grok video with model: ${createVideoDto.model}`)
    this.logger.log(`📝 Prompt: ${createVideoDto.prompt}`)
    if (files && files.length > 0) {
      this.logger.log(`🖼️ Reference images: ${files.length}`)
    }

    try {
      const result = await this.grokVideoService.createVideo(createVideoDto, files, userId)
      this.logger.log(`✅ Grok video task created: ${result.id}`)

      // 记录任务到数据库
      try {
        await this.videoTasksService.createTask(userId, {
          externalTaskId: result.id,
          platform: 'grok',
          model: createVideoDto.model || 'grok-video-3',
          prompt: createVideoDto.prompt,
          params: {
            channel: createVideoDto.channel || 'aifast',
            aspect_ratio: createVideoDto.aspect_ratio,
            seconds: createVideoDto.seconds,
            size: createVideoDto.size,
            hasReferenceImages: files && files.length > 0,
          },
          apiResponse: result,
        })
      } catch (dbErr) {
        this.logger.warn(`⚠️ Failed to save Grok task to DB: ${dbErr.message}`)
      }

      return result
    }
    catch (error) {
      this.logger.error(`❌ Failed to create Grok video: ${error.message}`)
      if (error.response?.data) {
        this.logger.error(`📋 API Response: ${JSON.stringify(error.response.data)}`)
      }
      throw new HttpException(
        {
          status: 'error',
          message: error.message,
          details: error.response?.data || null,
        },
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 查询 Grok 视频任务状态
   * GET /v1/grok/query?id=xxx
   */
  @Get('query')
  async queryVideo(@Query() queryDto: QueryGrokVideoDto, @Req() req?: any) {
    this.logger.log(`🔍 Querying Grok video task: ${queryDto.id}`)
    const userId = req?.user?.userId || 'unknown'

    try {
      const result = await this.grokVideoService.queryVideo(queryDto.id, userId, queryDto.channel)
      this.logger.log(`📊 Grok task status: ${result.status}`)

      // 更新数据库中的任务状态
      try {
        const updates: any = { lastQueryResponse: result }
        if (result.status === 'completed' || result.status === 'complete') {
          updates.status = 'completed'
          updates.progress = 100
          updates.video_url = result.video_url || result.output?.video_url
        } else if (result.status === 'processing' || result.status === 'in_progress') {
          updates.status = 'processing'
          updates.progress = result.progress || 50
        } else if (result.status === 'failed' || result.status === 'error') {
          updates.status = 'failed'
          updates.error = result.error || result.message
        }
        await this.videoTasksService.updateTaskByExternalId(queryDto.id, updates)
      } catch (dbErr) {
        this.logger.warn(`⚠️ Failed to update Grok task in DB: ${dbErr.message}`)
      }

      return result
    }
    catch (error) {
      this.logger.error(`❌ Failed to query Grok video: ${error.message}`)
      throw new HttpException(
        {
          status: 'error',
          message: error.message,
          details: error.response?.data || null,
        },
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}

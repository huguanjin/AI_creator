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
import { VeoService } from './veo.service'
import { CreateVeoVideoDto } from './dto/create-veo-video.dto'
import { QueryVeoVideoDto } from './dto/query-veo-video.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { VideoTasksService } from '../video-tasks/video-tasks.service'

@Controller('v1/veo')
@UseGuards(JwtAuthGuard)
export class VeoController {
  private readonly logger = new Logger(VeoController.name)

  constructor(
    private readonly veoService: VeoService,
    private readonly videoTasksService: VideoTasksService,
  ) {}

  /**
   * 创建 VEO 视频
   * POST /v1/veo/create
   * 支持 multipart/form-data 上传参考图
   */
  @Post('create')
  @UseInterceptors(FilesInterceptor('input_reference', 10)) // 最多 10 张参考图
  async createVideo(
    @Body() createVideoDto: CreateVeoVideoDto,
    @UploadedFiles() files?: Express.Multer.File[],
    @Req() req?: any,
  ) {
    const userId = req?.user?.userId || 'unknown'
    this.logger.log(`📹 Creating VEO video with model: ${createVideoDto.model}`)
    this.logger.log(`📝 Prompt: ${createVideoDto.prompt}`)
    if (files && files.length > 0) {
      this.logger.log(`🖼️ Reference images: ${files.length}`)
    }

    try {
      const result = await this.veoService.createVideo(createVideoDto, files, userId)
      this.logger.log(`✅ VEO video task created: ${result.id}`)

      // 获取当前使用的 API 配置
      const apiConfig = await this.veoService.getUserVeoConfig(userId)
      const apiServer = apiConfig.server
      const apiKeyMasked = apiConfig.key ? apiConfig.key.slice(0, 6) + '****' + apiConfig.key.slice(-4) : ''

      // 记录任务到数据库
      try {
        await this.videoTasksService.createTask(userId, {
          externalTaskId: result.id,
          platform: 'veo',
          model: createVideoDto.model || 'veo',
          prompt: createVideoDto.prompt,
          params: {
            size: createVideoDto.size,
            seconds: createVideoDto.seconds,
            hasReferenceImages: files && files.length > 0,
          },
          apiResponse: result,
          apiServer,
          apiKeyMasked,
        })
      } catch (dbErr) {
        this.logger.warn(`⚠️ Failed to save VEO task to DB: ${dbErr.message}`)
      }

      return result
    }
    catch (error) {
      this.logger.error(`❌ Failed to create VEO video: ${error.message}`)
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
   * 查询 VEO 视频任务状态
   * GET /v1/veo/query?id=xxx
   */
  @Get('query')
  async queryVideo(@Query() queryDto: QueryVeoVideoDto, @Req() req?: any) {
    this.logger.log(`🔍 Querying VEO video task: ${queryDto.id}`)
    const userId = req?.user?.userId || 'unknown'

    try {
      const result = await this.veoService.queryVideo(queryDto.id, userId)
      this.logger.log(`📊 VEO task status: ${result.status}`)

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
        this.logger.warn(`⚠️ Failed to update VEO task in DB: ${dbErr.message}`)
      }

      return result
    }
    catch (error) {
      this.logger.error(`❌ Failed to query VEO video: ${error.message}`)
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

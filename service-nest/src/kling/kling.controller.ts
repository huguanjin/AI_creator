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
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { KlingService } from './kling.service'
import { CreateKlingVideoDto } from './dto/create-kling-video.dto'
import { QueryKlingVideoDto } from './dto/query-kling-video.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { VideoTasksService } from '../video-tasks/video-tasks.service'

@Controller('v1/kling')
@UseGuards(JwtAuthGuard)
export class KlingController {
  private readonly logger = new Logger(KlingController.name)

  constructor(
    private readonly klingService: KlingService,
    private readonly videoTasksService: VideoTasksService,
  ) {}

  /**
   * 创建可灵视频
   * POST /v1/kling/create
   * 支持 multipart/form-data 上传参考图、尾帧图
   */
  @Post('create')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image_file', maxCount: 1 },
    { name: 'last_frame_file', maxCount: 1 },
    { name: 'reference_files', maxCount: 4 },
  ]))
  async createVideo(
    @Body() createVideoDto: CreateKlingVideoDto,
    @UploadedFiles() files?: { image_file?: Express.Multer.File[]; last_frame_file?: Express.Multer.File[]; reference_files?: Express.Multer.File[] },
    @Req() req?: any,
  ) {
    const userId = req?.user?.userId || 'unknown'
    this.logger.log(`📹 Creating Kling video with model: ${createVideoDto.model}`)
    this.logger.log(`📝 Prompt: ${createVideoDto.prompt}`)

    const imageFile = files?.image_file?.[0]
    const lastFrameFile = files?.last_frame_file?.[0]
    const referenceFiles = files?.reference_files

    if (imageFile) {
      this.logger.log(`🖼️ Image file: ${imageFile.originalname}`)
    }
    if (lastFrameFile) {
      this.logger.log(`🖼️ Last frame file: ${lastFrameFile.originalname}`)
    }
    if (referenceFiles && referenceFiles.length > 0) {
      this.logger.log(`🖼️ Reference files: ${referenceFiles.length}`)
    }

    try {
      const result = await this.klingService.createVideo(createVideoDto, userId, imageFile, lastFrameFile, referenceFiles)

      // 检查 API 是否返回了错误
      if (result.status === 'error' || result.status === 'failed' || !result.id) {
        const errorMsg = result.error?.message || result.error || result.message || '创建失败，未返回任务ID'
        this.logger.error(`❌ Kling API returned error: ${errorMsg}`)
        throw new HttpException(
          { status: 'error', message: errorMsg, details: result },
          HttpStatus.BAD_REQUEST,
        )
      }

      this.logger.log(`✅ Kling video task created: ${result.id}`)

      // 获取当前使用的 API 配置
      const apiConfig = await this.klingService.getUserKlingConfig(userId)
      const apiServer = apiConfig.server
      const apiKeyMasked = apiConfig.key ? apiConfig.key.slice(0, 6) + '****' + apiConfig.key.slice(-4) : ''

      // 记录任务到数据库
      try {
        let metadata: any = {}
        if (createVideoDto.metadata) {
          try { metadata = JSON.parse(createVideoDto.metadata) } catch {}
        }

        await this.videoTasksService.createTask(userId, {
          externalTaskId: result.id,
          platform: 'kling',
          model: createVideoDto.model,
          prompt: createVideoDto.prompt,
          params: {
            seconds: createVideoDto.seconds,
            size: createVideoDto.size,
            hasImage: !!createVideoDto.image || !!imageFile,
            hasImages: !!createVideoDto.images || (referenceFiles && referenceFiles.length > 0),
            hasLastFrame: !!lastFrameFile,
            scene_type: metadata.scene_type,
          },
          apiResponse: result,
          apiServer,
          apiKeyMasked,
        })
      } catch (dbErr) {
        this.logger.warn(`⚠️ Failed to save Kling task to DB: ${dbErr.message}`)
      }

      return result
    }
    catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      this.logger.error(`❌ Failed to create Kling video: ${error.message}`)
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
   * 查询可灵视频任务状态
   * GET /v1/kling/query?id=xxx
   */
  @Get('query')
  async queryVideo(@Query() queryDto: QueryKlingVideoDto, @Req() req?: any) {
    this.logger.log(`🔍 Querying Kling video task: ${queryDto.id}`)
    const userId = req?.user?.userId || 'unknown'

    try {
      const result = await this.klingService.queryVideo(queryDto.id, userId)
      this.logger.log(`📊 Kling task status: ${result.status}`)

      // 更新数据库中的任务状态
      try {
        const updates: any = { lastQueryResponse: result }
        if (result.status === 'completed' || result.status === 'complete') {
          updates.status = 'completed'
          updates.progress = 100
          updates.video_url = result.video_url || result.output?.video_url
        } else if (result.status === 'processing' || result.status === 'in_progress' || result.status === 'queued') {
          updates.status = result.status === 'queued' ? 'queued' : 'processing'
          updates.progress = result.progress || 0
        } else if (result.status === 'failed' || result.status === 'error') {
          updates.status = 'failed'
          updates.error = result.error?.message || result.error || result.message
        }
        await this.videoTasksService.updateTaskByExternalId(queryDto.id, updates)
      } catch (dbErr) {
        this.logger.warn(`⚠️ Failed to update Kling task in DB: ${dbErr.message}`)
      }

      return result
    }
    catch (error) {
      this.logger.error(`❌ Failed to query Kling video: ${error.message}`)
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

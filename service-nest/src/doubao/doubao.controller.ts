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
import { DoubaoService } from './doubao.service'
import { CreateDoubaoVideoDto } from './dto/create-doubao-video.dto'
import { QueryDoubaoVideoDto } from './dto/query-doubao-video.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { VideoTasksService } from '../video-tasks/video-tasks.service'

@Controller('v1/doubao')
@UseGuards(JwtAuthGuard)
export class DoubaoController {
  private readonly logger = new Logger(DoubaoController.name)

  constructor(
    private readonly doubaoService: DoubaoService,
    private readonly videoTasksService: VideoTasksService,
  ) {}

  /**
   * 创建豆包视频
   * POST /v1/doubao/create
   * 支持 multipart/form-data 上传首帧/尾帧/参考图
   */
  @Post('create')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'first_frame_image', maxCount: 1 },
    { name: 'last_frame_image', maxCount: 1 },
    { name: 'reference_images', maxCount: 4 },
  ]))
  async createVideo(
    @Body() createVideoDto: CreateDoubaoVideoDto,
    @UploadedFiles() files?: { first_frame_image?: Express.Multer.File[]; last_frame_image?: Express.Multer.File[]; reference_images?: Express.Multer.File[] },
    @Req() req?: any,
  ) {
    const userId = req?.user?.userId || 'unknown'
    const channel = createVideoDto.channel || 'aifast'
    this.logger.log(`📹 Creating Doubao video [${channel}] with model: ${createVideoDto.model}`)
    this.logger.log(`📝 Prompt: ${createVideoDto.prompt}`)

    const firstFrameFile = files?.first_frame_image?.[0]
    const lastFrameFile = files?.last_frame_image?.[0]
    const referenceFiles = files?.reference_images

    if (firstFrameFile) {
      this.logger.log(`🖼️ First frame image: ${firstFrameFile.originalname}`)
    }
    if (lastFrameFile) {
      this.logger.log(`🖼️ Last frame image: ${lastFrameFile.originalname}`)
    }
    if (referenceFiles && referenceFiles.length > 0) {
      this.logger.log(`🖼️ Reference images: ${referenceFiles.length}`)
    }

    try {
      const result = await this.doubaoService.createVideo(
        createVideoDto,
        firstFrameFile,
        lastFrameFile,
        referenceFiles,
        userId,
      )
      this.logger.log(`✅ Doubao video task created: ${result.id}`)

      // 记录任务到数据库
      try {
        await this.videoTasksService.createTask(userId, {
          externalTaskId: result.id,
          platform: 'doubao',
          model: createVideoDto.model || 'doubao',
          prompt: createVideoDto.prompt,
          params: {
            channel,
            size: createVideoDto.size,
            seconds: createVideoDto.seconds,
            resolution: createVideoDto.resolution,
            hasFirstFrame: !!firstFrameFile,
            hasLastFrame: !!lastFrameFile,
            hasReferenceImages: referenceFiles && referenceFiles.length > 0,
          },
          apiResponse: result,
        })
      } catch (dbErr) {
        this.logger.warn(`⚠️ Failed to save Doubao task to DB: ${dbErr.message}`)
      }

      return result
    } catch (error) {
      this.logger.error(`❌ Failed to create Doubao video: ${error.message}`)
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
   * 查询豆包视频任务状态
   * GET /v1/doubao/query?id=xxx&channel=aifast
   */
  @Get('query')
  async queryVideo(@Query() queryDto: QueryDoubaoVideoDto, @Req() req?: any) {
    const channel = queryDto.channel || 'aifast'
    this.logger.log(`🔍 Querying Doubao video task [${channel}]: ${queryDto.id}`)
    const userId = req?.user?.userId || 'unknown'

    try {
      const result = await this.doubaoService.queryVideo(queryDto.id, userId, queryDto.channel)
      this.logger.log(`📊 Doubao task status: ${result.status}`)

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
          updates.error = result.error?.message || result.message
        }
        await this.videoTasksService.updateTaskByExternalId(queryDto.id, updates)
      } catch (dbErr) {
        this.logger.warn(`⚠️ Failed to update Doubao task in DB: ${dbErr.message}`)
      }

      return result
    } catch (error) {
      this.logger.error(`❌ Failed to query Doubao video: ${error.message}`)
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

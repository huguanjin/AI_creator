import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { DoubaoService } from './doubao.service'
import { CreateDoubaoVideoDto } from './dto/create-doubao-video.dto'
import { QueryDoubaoVideoDto } from './dto/query-doubao-video.dto'
import { UploadAssetDto } from './dto/upload-asset.dto'
import { QueryAssetDto } from './dto/query-asset.dto'
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

      // 获取当前使用的 API 配置
      const fullConfig = await this.doubaoService.getUserDoubaoConfig(userId)
      const channelConfig = this.doubaoService.getChannelConfig(fullConfig, channel)
      const apiServer = channelConfig.server
      const apiKeyMasked = channelConfig.key ? channelConfig.key.slice(0, 6) + '****' + channelConfig.key.slice(-4) : ''

      // 记录任务到数据库
      try {
        await this.videoTasksService.createTask(userId, {
          externalTaskId: result.id || result.task_id,
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
            // seedance2 特有参数
            ...(channel === 'seedance2' ? {
              image: createVideoDto.image ? '(provided)' : undefined,
              duration: createVideoDto.duration,
              width: createVideoDto.width,
              height: createVideoDto.height,
              fps: createVideoDto.fps,
              n: createVideoDto.n,
            } : {}),
          },
          apiResponse: result,
          apiServer,
          apiKeyMasked,
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
        if (result.status === 'completed' || result.status === 'complete' || result.status === 'succeeded') {
          updates.status = 'completed'
          updates.progress = 100
          updates.video_url = result.video_url || result.output?.video_url || result.metadata?.video_url || result.metadata?.url
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

  /**
   * 代理下载视频文件 (Seedance 2.0)
   * GET /v1/doubao/download/:taskId
   * 仅在任务状态为 succeeded 时可用
   */
  @Get('download/:taskId')
  async downloadVideo(
    @Param('taskId') taskId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userId = req?.user?.userId || 'unknown'
    this.logger.log(`📥 Downloading Doubao video: ${taskId}`)

    try {
      const response = await this.doubaoService.downloadVideo(taskId, userId)

      // 设置响应头
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type'])
      } else {
        res.setHeader('Content-Type', 'video/mp4')
      }
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length'])
      }
      res.setHeader('Content-Disposition', `attachment; filename="${taskId}.mp4"`)

      // pipe 流到响应
      response.data.pipe(res)
    } catch (error) {
      this.logger.error(`❌ Failed to download video: ${error.message}`)
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
   * 上传素材 (Seedance 2.0 图生视频场景)
   * POST /v1/doubao/asset/upload
   * 请求体透传至上游
   */
  @Post('asset/upload')
  async uploadAsset(@Body() uploadAssetDto: UploadAssetDto, @Req() req?: any) {
    const userId = req?.user?.userId || 'unknown'
    this.logger.log(`📤 Uploading asset`)

    try {
      const result = await this.doubaoService.uploadAsset(uploadAssetDto, userId)
      this.logger.log(`✅ Asset uploaded: ${result.id || 'ok'}`)
      return result
    } catch (error) {
      this.logger.error(`❌ Failed to upload asset: ${error.message}`)
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
   * 查询素材信息 (Seedance 2.0)
   * GET /v1/doubao/asset/query?id=xxx
   */
  @Get('asset/query')
  async queryAsset(@Query() queryAssetDto: QueryAssetDto, @Req() req?: any) {
    const userId = req?.user?.userId || 'unknown'
    this.logger.log(`🔍 Querying asset: ${queryAssetDto.id}`)

    try {
      const result = await this.doubaoService.queryAsset(queryAssetDto.id, userId)
      return result
    } catch (error) {
      this.logger.error(`❌ Failed to query asset: ${error.message}`)
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

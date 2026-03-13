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
import { ViduService } from './vidu.service'
import { CreateViduVideoDto } from './dto/create-vidu-video.dto'
import { QueryViduVideoDto } from './dto/query-vidu-video.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { VideoTasksService } from '../video-tasks/video-tasks.service'

@Controller('v1/vidu')
@UseGuards(JwtAuthGuard)
export class ViduController {
  private readonly logger = new Logger(ViduController.name)

  constructor(
    private readonly viduService: ViduService,
    private readonly videoTasksService: VideoTasksService,
  ) {}

  /**
   * 创建 Vidu 视频
   * POST /v1/vidu/create
   * 支持 multipart/form-data 上传参考图
   * channel=default: 测试接口官转接口1
   * channel=aifast: AIFAST站接口
   */
  @Post('create')
  @UseInterceptors(FilesInterceptor('input_reference', 10))
  async createVideo(
    @Body() createVideoDto: CreateViduVideoDto,
    @UploadedFiles() files?: Express.Multer.File[],
    @Req() req?: any,
  ) {
    const userId = req?.user?.userId || 'unknown'
    const channel = createVideoDto.channel || 'default'
    this.logger.log(`📹 Creating Vidu video [${channel}] [${createVideoDto.task_type || 'text2video'}] with model: ${createVideoDto.model}`)
    this.logger.log(`📝 Prompt: ${createVideoDto.prompt}`)
    if (files && files.length > 0) {
      this.logger.log(`🖼️ Reference images: ${files.length}`)
    }

    try {
      const result = await this.viduService.createVideo(createVideoDto, files, userId)

      // 检查 API 是否返回了错误
      if (result.status === 'error' || result.status === 'failed' || !result.id) {
        const errorMsg = result.error || result.message || '创建失败，未返回任务ID'
        this.logger.error(`❌ Vidu API returned error: ${errorMsg}`)
        throw new HttpException(
          { status: 'error', message: errorMsg, details: result },
          HttpStatus.BAD_REQUEST,
        )
      }

      this.logger.log(`✅ Vidu video task created [${channel}]: ${result.id}`)

      // 获取当前使用的 API 配置
      const apiConfig = await this.viduService.getUserViduConfig(userId)
      const apiServer = apiConfig.server
      const apiKeyMasked = apiConfig.key ? apiConfig.key.slice(0, 6) + '****' + apiConfig.key.slice(-4) : ''

      // 记录任务到数据库
      try {
        await this.videoTasksService.createTask(userId, {
          externalTaskId: result.id,
          platform: 'vidu',
          model: createVideoDto.model || 'TC-vidu-q2',
          prompt: createVideoDto.prompt,
          params: {
            task_type: createVideoDto.task_type || 'text2video',
            duration: createVideoDto.duration,
            aspect_ratio: createVideoDto.aspect_ratio,
            resolution: createVideoDto.resolution,
            channel,
            hasReferenceImages: files && files.length > 0,
          },
          apiResponse: result,
          apiServer,
          apiKeyMasked,
        })
      } catch (dbErr) {
        this.logger.warn(`⚠️ Failed to save Vidu task to DB: ${dbErr.message}`)
      }

      return result
    }
    catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      this.logger.error(`❌ Failed to create Vidu video: ${error.message}`)
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
   * 查询 Vidu 视频任务状态
   * GET /v1/vidu/query?id=xxx&channel=aifast
   */
  @Get('query')
  async queryVideo(@Query() queryDto: QueryViduVideoDto, @Req() req?: any) {
    const channel = queryDto.channel || 'default'
    this.logger.log(`🔍 Querying Vidu video task [${channel}]: ${queryDto.id}`)
    const userId = req?.user?.userId || 'unknown'

    try {
      const result = await this.viduService.queryVideo(queryDto.id, userId, channel)
      this.logger.log(`📊 Vidu task status [${channel}]: ${result.status}`)

      // 更新数据库中的任务状态
      try {
        const updates: any = { lastQueryResponse: result }
        if (result.status === 'completed') {
          updates.status = 'completed'
          updates.progress = 100
          updates.video_url = result.video_url
        } else if (result.status === 'processing') {
          updates.status = 'processing'
          updates.progress = result.progress || 50
        } else if (result.status === 'failed') {
          updates.status = 'failed'
          updates.error = result.error
        }
        await this.videoTasksService.updateTaskByExternalId(queryDto.id, updates)
      } catch (dbErr) {
        this.logger.warn(`⚠️ Failed to update Vidu task in DB: ${dbErr.message}`)
      }

      return result
    }
    catch (error) {
      this.logger.error(`❌ Failed to query Vidu video: ${error.message}`)
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

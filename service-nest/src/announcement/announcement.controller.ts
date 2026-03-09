import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AnnouncementService } from './announcement.service'

@Controller('v1/announcements')
export class AnnouncementController {
  private readonly logger = new Logger(AnnouncementController.name)

  constructor(private readonly announcementService: AnnouncementService) {}

  /**
   * 管理员角色检查
   */
  private ensureAdmin(req: any) {
    if (req.user?.role !== 'admin') {
      throw new HttpException(
        { status: 'error', message: '需要管理员权限' },
        HttpStatus.FORBIDDEN,
      )
    }
  }

  /**
   * 获取最新公告（公开接口, 用户端展示）
   * GET /v1/announcements/latest?limit=5
   */
  @Get('latest')
  async getLatest(@Query('limit') limit?: string) {
    const data = await this.announcementService.getLatest(
      limit ? parseInt(limit, 10) : 5,
    )
    return { status: 'success', data }
  }

  /**
   * 获取公告列表（管理员）
   * GET /v1/announcements?page=1&limit=20
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getList(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.ensureAdmin(req)
    const result = await this.announcementService.getList({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    })
    return { status: 'success', ...result }
  }

  /**
   * 创建公告（管理员）
   * POST /v1/announcements
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() req: any,
    @Body() body: { content: string; publishDate?: string; type?: string; description?: string },
  ) {
    this.ensureAdmin(req)

    if (!body.content || !body.content.trim()) {
      throw new HttpException(
        { status: 'error', message: '公告内容不能为空' },
        HttpStatus.BAD_REQUEST,
      )
    }
    if (body.content.length > 500) {
      throw new HttpException(
        { status: 'error', message: '公告内容不能超过500字' },
        HttpStatus.BAD_REQUEST,
      )
    }

    const announcement = await this.announcementService.create({
      content: body.content.trim(),
      publishDate: body.publishDate,
      type: body.type,
      description: body.description?.trim(),
      createdBy: req.user.userId,
    })

    return { status: 'success', data: announcement }
  }

  /**
   * 更新公告（管理员）
   * PUT /v1/announcements/:id
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { content?: string; publishDate?: string; type?: string; description?: string },
  ) {
    this.ensureAdmin(req)

    if (body.content !== undefined && body.content.length > 500) {
      throw new HttpException(
        { status: 'error', message: '公告内容不能超过500字' },
        HttpStatus.BAD_REQUEST,
      )
    }

    const success = await this.announcementService.update(id, body)
    if (!success) {
      throw new HttpException(
        { status: 'error', message: '公告不存在或更新失败' },
        HttpStatus.NOT_FOUND,
      )
    }
    return { status: 'success', message: '更新成功' }
  }

  /**
   * 删除公告（管理员）
   * DELETE /v1/announcements/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Req() req: any, @Param('id') id: string) {
    this.ensureAdmin(req)
    const success = await this.announcementService.delete(id)
    if (!success) {
      throw new HttpException(
        { status: 'error', message: '公告不存在或删除失败' },
        HttpStatus.NOT_FOUND,
      )
    }
    return { status: 'success', message: '删除成功' }
  }

  /**
   * 批量删除公告（管理员）
   * DELETE /v1/announcements
   */
  @Delete()
  @UseGuards(JwtAuthGuard)
  async deleteMany(
    @Req() req: any,
    @Body() body: { ids: string[] },
  ) {
    this.ensureAdmin(req)
    if (!body.ids || !body.ids.length) {
      throw new HttpException(
        { status: 'error', message: '请提供要删除的公告ID列表' },
        HttpStatus.BAD_REQUEST,
      )
    }
    const count = await this.announcementService.deleteMany(body.ids)
    return { status: 'success', message: `已删除${count}条公告` }
  }
}

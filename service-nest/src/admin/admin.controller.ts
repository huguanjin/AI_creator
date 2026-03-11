import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AuthService } from '../auth/auth.service'
import { AdminService } from './admin.service'

@Controller('v1/admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name)

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

  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 获取所有用户列表
   * GET /v1/admin/users?page=1&limit=20
   */
  @Get('users')
  async getUsers(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('keyword') keyword?: string,
  ) {
    this.ensureAdmin(req)
    this.logger.log(`👑 Admin listing users`)

    const result = await this.adminService.getUsers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      role,
      keyword,
    })

    return { status: 'success', ...result }
  }

  /**
   * 获取指定用户详情（含配置信息）
   * GET /v1/admin/users/:userId
   */
  @Get('users/:userId')
  async getUserDetail(@Req() req: any, @Param('userId') userId: string) {
    this.ensureAdmin(req)
    this.logger.log(`👑 Admin viewing user: ${userId}`)

    const detail = await this.adminService.getUserDetail(userId)
    if (!detail) {
      throw new HttpException(
        { status: 'error', message: '用户不存在' },
        HttpStatus.NOT_FOUND,
      )
    }

    return { status: 'success', data: detail }
  }

  /**
   * 获取指定用户的完整配置（含 API Key，供管理员查看）
   * GET /v1/admin/users/:userId/config
   */
  @Get('users/:userId/config')
  async getUserFullConfig(@Req() req: any, @Param('userId') userId: string) {
    this.ensureAdmin(req)
    this.logger.log(`👑 Admin viewing user full config: ${userId}`)

    const result = await this.adminService.getUserFullConfig(userId)
    if (!result) {
      throw new HttpException(
        { status: 'error', message: '用户不存在' },
        HttpStatus.NOT_FOUND,
      )
    }

    return { status: 'success', data: result }
  }

  /**
   * 获取指定用户的视频任务列表
   * GET /v1/admin/users/:userId/video-tasks?page=1&limit=20&platform=sora
   */
  @Get('users/:userId/video-tasks')
  async getUserVideoTasks(
    @Req() req: any,
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
  ) {
    this.ensureAdmin(req)

    const result = await this.adminService.getUserVideoTasks(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      platform: platform as any,
      status,
    })

    return { status: 'success', ...result }
  }

  /**
   * 获取指定用户的图片任务列表
   * GET /v1/admin/users/:userId/image-tasks?page=1&limit=20
   */
  @Get('users/:userId/image-tasks')
  async getUserImageTasks(
    @Req() req: any,
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.ensureAdmin(req)

    const result = await this.adminService.getUserImageTasks(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    })

    return { status: 'success', ...result }
  }

  /**
   * 管理员重置用户密码
   * PUT /v1/admin/users/:userId/reset-password
   */
  @Put('users/:userId/reset-password')
  async resetUserPassword(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { newPassword: string },
  ) {
    this.ensureAdmin(req)

    if (!body.newPassword || body.newPassword.length < 6) {
      throw new HttpException(
        { status: 'error', message: '新密码至少 6 个字符' },
        HttpStatus.BAD_REQUEST,
      )
    }

    // 不允许重置自己的密码（应通过修改密码功能）
    if (userId === req.user.userId) {
      throw new HttpException(
        { status: 'error', message: '不能通过此接口修改自己的密码，请使用修改密码功能' },
        HttpStatus.BAD_REQUEST,
      )
    }

    const success = await this.authService.resetPassword(userId, body.newPassword)
    if (!success) {
      throw new HttpException(
        { status: 'error', message: '用户不存在' },
        HttpStatus.NOT_FOUND,
      )
    }

    this.logger.log(`👑 Admin ${req.user.username} reset password for userId: ${userId}`)
    return { status: 'success', message: '密码重置成功' }
  }

  /**
   * 管理员任务管理 - 查询所有用户任务
   * GET /v1/admin/tasks?page=1&limit=20&username=xxx&platform=sora&status=completed&startTime=xxx&endTime=xxx
   * 默认查询当天任务
   */
  @Get('tasks')
  async getAllTasks(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('username') username?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    this.ensureAdmin(req)
    this.logger.log(`👑 Admin querying tasks`)

    // 默认查当天
    let start = startTime ? parseInt(startTime, 10) : undefined
    let end = endTime ? parseInt(endTime, 10) : undefined
    if (!start && !end && !userId && !username) {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      start = todayStart.getTime()
    }

    const result = await this.adminService.getAllTasks({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      userId,
      username,
      platform,
      status,
      startTime: start,
      endTime: end,
    })

    return { status: 'success', ...result }
  }

  /**
   * 获取平台统计概览
   * GET /v1/admin/stats
   */
  @Get('stats')
  async getStats(@Req() req: any) {
    this.ensureAdmin(req)
    const stats = await this.adminService.getStats()
    return { status: 'success', data: stats }
  }
}

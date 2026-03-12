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
import { ModelCatalogService } from './model-catalog.service'
import { CreateModelCatalogDto } from './dto/create-model-catalog.dto'
import { UpdateModelCatalogDto } from './dto/update-model-catalog.dto'

@Controller('v1/model-catalog')
@UseGuards(JwtAuthGuard)
export class ModelCatalogController {
  private readonly logger = new Logger(ModelCatalogController.name)

  constructor(private readonly modelCatalogService: ModelCatalogService) {}

  private ensureAdmin(req: any) {
    if (req.user?.role !== 'admin') {
      throw new HttpException(
        { status: 'error', message: '需要管理员权限' },
        HttpStatus.FORBIDDEN,
      )
    }
  }

  /**
   * 获取指定平台的已启用模型（普通用户可用，用于前端下拉菜单）
   * GET /v1/model-catalog/platform/:platform
   */
  @Get('platform/:platform')
  async getByPlatform(@Param('platform') platform: string) {
    const models = await this.modelCatalogService.getByPlatform(platform)

    // 按 category 分组
    const grouped: Record<string, { name: string; value: string }[]> = {}
    for (const m of models) {
      if (!grouped[m.category]) grouped[m.category] = []
      grouped[m.category].push({ name: m.name, value: m.value })
    }

    return { status: 'success', data: grouped }
  }

  /**
   * 获取所有平台的已启用模型（一次性获取，减少请求数）
   * GET /v1/model-catalog/all-platforms
   */
  @Get('all-platforms')
  async getAllPlatforms() {
    const platforms = ['sora', 'veo', 'grok', 'doubao', 'kling', 'vidu']
    const result: Record<string, Record<string, { name: string; value: string }[]>> = {}

    for (const platform of platforms) {
      const models = await this.modelCatalogService.getByPlatform(platform)
      const grouped: Record<string, { name: string; value: string }[]> = {}
      for (const m of models) {
        if (!grouped[m.category]) grouped[m.category] = []
        grouped[m.category].push({ name: m.name, value: m.value })
      }
      result[platform] = grouped
    }

    return { status: 'success', data: result }
  }

  /**
   * 获取所有模型（管理员，包含禁用的）
   * GET /v1/model-catalog?platform=kling
   */
  @Get()
  async getAll(@Req() req: any, @Query('platform') platform?: string) {
    this.ensureAdmin(req)
    const models = await this.modelCatalogService.getAll(platform)
    return { status: 'success', data: models }
  }

  /**
   * 创建模型
   * POST /v1/model-catalog
   */
  @Post()
  async create(@Req() req: any, @Body() dto: CreateModelCatalogDto) {
    this.ensureAdmin(req)

    if (!dto.platform || !dto.category || !dto.name || !dto.value) {
      throw new HttpException(
        { status: 'error', message: '平台、分类、名称、值为必填项' },
        HttpStatus.BAD_REQUEST,
      )
    }

    try {
      const model = await this.modelCatalogService.create(dto)
      return { status: 'success', data: model }
    } catch (error) {
      if (error.code === 11000) {
        throw new HttpException(
          { status: 'error', message: '该平台下已存在相同值的模型' },
          HttpStatus.CONFLICT,
        )
      }
      throw error
    }
  }

  /**
   * 更新模型
   * PUT /v1/model-catalog/:id
   */
  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateModelCatalogDto) {
    this.ensureAdmin(req)
    const model = await this.modelCatalogService.update(id, dto)
    if (!model) {
      throw new HttpException(
        { status: 'error', message: '模型不存在' },
        HttpStatus.NOT_FOUND,
      )
    }
    return { status: 'success', data: model }
  }

  /**
   * 删除模型
   * DELETE /v1/model-catalog/:id
   */
  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    this.ensureAdmin(req)
    const deleted = await this.modelCatalogService.delete(id)
    if (!deleted) {
      throw new HttpException(
        { status: 'error', message: '模型不存在' },
        HttpStatus.NOT_FOUND,
      )
    }
    return { status: 'success', message: '已删除' }
  }

  /**
   * 切换模型启用/禁用
   * PUT /v1/model-catalog/:id/toggle
   */
  @Put(':id/toggle')
  async toggleEnabled(@Req() req: any, @Param('id') id: string) {
    this.ensureAdmin(req)
    const model = await this.modelCatalogService.toggleEnabled(id)
    if (!model) {
      throw new HttpException(
        { status: 'error', message: '模型不存在' },
        HttpStatus.NOT_FOUND,
      )
    }
    return { status: 'success', data: model }
  }

  /**
   * 初始化默认模型数据
   * POST /v1/model-catalog/seed
   */
  @Post('seed')
  async seedDefaults(@Req() req: any) {
    this.ensureAdmin(req)
    const result = await this.modelCatalogService.seedDefaults()
    return { status: 'success', data: result }
  }
}

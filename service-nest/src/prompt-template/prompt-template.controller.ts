import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PromptTemplateService } from './prompt-template.service'
import { CreatePromptTemplateDto } from './create-prompt-template.dto'
import { UpdatePromptTemplateDto } from './update-prompt-template.dto'

@Controller('v1/prompt-template')
export class PromptTemplateController {
  constructor(private readonly promptTemplateService: PromptTemplateService) {}

  /**
   * 获取已启用的模板列表（用户使用）
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getEnabled() {
    const templates = await this.promptTemplateService.getEnabled()
    return { status: 'success', data: templates }
  }

  /**
   * 获取所有模板（管理员使用）
   */
  @Get('all')
  @UseGuards(JwtAuthGuard)
  async getAll() {
    const templates = await this.promptTemplateService.getAll()
    return { status: 'success', data: templates }
  }

  /**
   * 创建模板
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePromptTemplateDto) {
    const template = await this.promptTemplateService.create(dto)
    return { status: 'success', data: template }
  }

  /**
   * 更新模板
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() dto: UpdatePromptTemplateDto) {
    const template = await this.promptTemplateService.update(id, dto)
    if (!template) {
      return { status: 'error', message: '模板不存在' }
    }
    return { status: 'success', data: template }
  }

  /**
   * 删除模板
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string) {
    const success = await this.promptTemplateService.delete(id)
    if (!success) {
      return { status: 'error', message: '模板不存在' }
    }
    return { status: 'success', message: '删除成功' }
  }

  /**
   * 切换启用状态
   */
  @Put(':id/toggle')
  @UseGuards(JwtAuthGuard)
  async toggleEnabled(@Param('id') id: string) {
    const template = await this.promptTemplateService.toggleEnabled(id)
    if (!template) {
      return { status: 'error', message: '模板不存在' }
    }
    return { status: 'success', data: template }
  }
}

import { Module } from '@nestjs/common'
import { PromptTemplateService } from './prompt-template.service'
import { PromptTemplateController } from './prompt-template.controller'
import { DatabaseModule } from '../database/database.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PromptTemplateController],
  providers: [PromptTemplateService],
  exports: [PromptTemplateService],
})
export class PromptTemplateModule {}

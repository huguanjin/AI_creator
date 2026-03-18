import { Module } from '@nestjs/common'
import { PromptPolishService } from './prompt-polish.service'
import { PromptPolishController } from './prompt-polish.controller'
import { ConfigModule } from '../config/config.module'
import { UserConfigModule } from '../user-config/user-config.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [ConfigModule, UserConfigModule, AuthModule],
  controllers: [PromptPolishController],
  providers: [PromptPolishService],
  exports: [PromptPolishService],
})
export class PromptPolishModule {}

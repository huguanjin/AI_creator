import { Module } from '@nestjs/common'
import { KlingController } from './kling.controller'
import { KlingService } from './kling.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [KlingController],
  providers: [KlingService],
  exports: [KlingService],
})
export class KlingModule {}

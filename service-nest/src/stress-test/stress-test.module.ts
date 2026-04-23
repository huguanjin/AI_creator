import { Module } from '@nestjs/common'
import { StressTestController } from './stress-test.controller'
import { StressTestService } from './stress-test.service'
import { GeminiImageModule } from '../gemini-image/gemini-image.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [GeminiImageModule, AuthModule],
  controllers: [StressTestController],
  providers: [StressTestService],
})
export class StressTestModule {}

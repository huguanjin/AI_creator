import { Module } from '@nestjs/common'
import { ViduController } from './vidu.controller'
import { ViduService } from './vidu.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [ViduController],
  providers: [ViduService],
  exports: [ViduService],
})
export class ViduModule {}

import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AnnouncementController } from './announcement.controller'
import { AnnouncementService } from './announcement.service'

@Module({
  imports: [AuthModule],
  controllers: [AnnouncementController],
  providers: [AnnouncementService],
})
export class AnnouncementModule {}

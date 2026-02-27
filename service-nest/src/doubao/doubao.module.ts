import { Module } from '@nestjs/common'
import { DoubaoController } from './doubao.controller'
import { DoubaoService } from './doubao.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [DoubaoController],
  providers: [DoubaoService],
  exports: [DoubaoService],
})
export class DoubaoModule {}

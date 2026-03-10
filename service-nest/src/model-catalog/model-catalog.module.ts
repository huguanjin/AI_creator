import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ModelCatalogController } from './model-catalog.controller'
import { ModelCatalogService } from './model-catalog.service'

@Module({
  imports: [AuthModule],
  controllers: [ModelCatalogController],
  providers: [ModelCatalogService],
  exports: [ModelCatalogService],
})
export class ModelCatalogModule {}

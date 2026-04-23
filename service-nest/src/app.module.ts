import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { SoraModule } from './sora/sora.module'
import { VeoModule } from './veo/veo.module'
import { GeminiImageModule } from './gemini-image/gemini-image.module'
import { GrokVideoModule } from './grok-video/grok-video.module'
import { KlingModule } from './kling/kling.module'
import { DoubaoModule } from './doubao/doubao.module'
import { ViduModule } from './vidu/vidu.module'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { AuthModule } from './auth/auth.module'
import { UserConfigModule } from './user-config/user-config.module'
import { VideoTasksModule } from './video-tasks/video-tasks.module'
import { FileStorageModule } from './file-storage/file-storage.module'
import { AdminModule } from './admin/admin.module'
import { FeedbackModule } from './feedback/feedback.module'
import { EmailModule } from './email/email.module'
import { AnnouncementModule } from './announcement/announcement.module'
import { ModelCatalogModule } from './model-catalog/model-catalog.module'
import { PromptTemplateModule } from './prompt-template/prompt-template.module'
import { PromptPolishModule } from './prompt-polish/prompt-polish.module'
import { StressTestModule } from './stress-test/stress-test.module'

@Module({
  imports: [
    // NestJS 配置模块 - 加载 .env 文件（启动时使用）
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // MongoDB 数据库模块（全局）
    DatabaseModule,
    // 邮件服务模块（全局）
    EmailModule,
    // 用户认证模块
    AuthModule,
    // 用户级 API 配置模块（全局）
    UserConfigModule,
    // 视频任务记录模块（全局）
    VideoTasksModule,
    // 文件存储模块（全局）- 图片按用户文件夹存储
    FileStorageModule,
    // 自定义配置模块 - 支持动态更新（存储在 MongoDB）
    ConfigModule,
    // Sora 视频生成模块
    SoraModule,
    // VEO 视频生成模块
    VeoModule,
    // Gemini 图片生成模块
    GeminiImageModule,
    // Grok 视频生成模块
    GrokVideoModule,
    // 可灵视频生成模块
    KlingModule,
    // 豆包视频生成模块
    DoubaoModule,
    // Vidu 视频生成模块
    ViduModule,
    // 管理员模块 - 用户管理、任务统计
    AdminModule,
    // 问题反馈模块
    FeedbackModule,
    // 系统公告模块
    AnnouncementModule,
    // 模型目录管理模块
    ModelCatalogModule,
    // 提示词模板模块
    PromptTemplateModule,
    // 提示词润色模块
    PromptPolishModule,
    // RPM 压力测试模块
    StressTestModule,
  ],
})
export class AppModule {}

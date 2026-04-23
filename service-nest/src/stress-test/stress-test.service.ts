import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { GeminiImageService } from '../gemini-image/gemini-image.service'
import { DatabaseService } from '../database/database.service'
import { StartStressTestDto } from './dto/start-stress-test.dto'

/** 单个请求结果 */
interface RequestResult {
  success: boolean
  latencyMs: number
  error?: string
  timestamp: number
}

/** 运行中的压测会话内存状态 */
interface RunningSession {
  timer: ReturnType<typeof setInterval>
  stopFlag: boolean
  promptIndex: number
  stats: {
    totalSent: number
    totalSuccess: number
    totalFailed: number
    inFlight: number
    latencies: number[]
    errors: Array<{ time: number; message: string }>
    startTime: number
    endTime?: number
  }
}

/** 压测会话文档 (MongoDB) */
export interface StressTestSession {
  sessionId: string
  userId: string
  config: StartStressTestDto
  status: 'running' | 'completed' | 'stopped' | 'error'
  stats: RunningSession['stats']
  createdAt: number
}

@Injectable()
export class StressTestService {
  private readonly logger = new Logger(StressTestService.name)
  /** 内存中的运行中会话 */
  private runningSessions = new Map<string, RunningSession>()
  /** 用户 → sessionId 映射，限制每用户 1 个运行中会话 */
  private userSessions = new Map<string, string>()

  constructor(
    private readonly geminiImageService: GeminiImageService,
    private readonly databaseService: DatabaseService,
  ) {}

  private getCollection() {
    return this.databaseService.getDb().collection('stress_test_sessions')
  }

  /**
   * 启动压测
   */
  async startTest(dto: StartStressTestDto, userId: string): Promise<{ sessionId: string; status: string }> {
    // 检查该用户是否已有运行中的会话
    const existingSessionId = this.userSessions.get(userId)
    if (existingSessionId && this.runningSessions.has(existingSessionId)) {
      throw new Error('您已有一个正在运行的压测会话，请先停止后再启动新的')
    }

    if (!dto.prompts || dto.prompts.length === 0) {
      throw new Error('至少需要提供一条提示词')
    }

    const sessionId = randomUUID()
    const now = Date.now()

    const session: RunningSession = {
      timer: null as any,
      stopFlag: false,
      promptIndex: 0,
      stats: {
        totalSent: 0,
        totalSuccess: 0,
        totalFailed: 0,
        inFlight: 0,
        latencies: [],
        errors: [],
        startTime: now,
      },
    }

    // 保存到 MongoDB
    const doc: StressTestSession = {
      sessionId,
      userId,
      config: dto,
      status: 'running',
      stats: session.stats,
      createdAt: now,
    }
    await this.getCollection().insertOne(doc as any)

    // 注册到内存
    this.runningSessions.set(sessionId, session)
    this.userSessions.set(userId, sessionId)

    // 启动定时发送
    const intervalMs = 60000 / dto.rpm
    this.logger.log(`⚡ Stress test started: ${sessionId}, RPM=${dto.rpm}, interval=${intervalMs.toFixed(0)}ms`)

    session.timer = setInterval(() => {
      this.fireRequest(sessionId, dto, userId)
    }, intervalMs)

    // 立即发送第一个请求
    this.fireRequest(sessionId, dto, userId)

    return { sessionId, status: 'running' }
  }

  /**
   * 发送单个压测请求
   */
  private async fireRequest(sessionId: string, dto: StartStressTestDto, userId: string): Promise<void> {
    const session = this.runningSessions.get(sessionId)
    if (!session || session.stopFlag) return

    // 如果设置了总请求数且已达到，停止
    if (dto.totalRequests && session.stats.totalSent >= dto.totalRequests) {
      this.finishSession(sessionId, userId, 'completed')
      return
    }

    // 循环取提示词
    const prompt = dto.prompts[session.promptIndex % dto.prompts.length]
    session.promptIndex++
    session.stats.totalSent++
    session.stats.inFlight++

    // 异步发送，不阻塞 interval
    const imageDto = {
      model: dto.model,
      channel: dto.channel,
      prompt,
      aspectRatio: dto.aspectRatio,
      imageSize: dto.imageSize,
      size: dto.size,
      n: dto.n,
    }

    try {
      const result = await this.geminiImageService.stressTestGenerate(imageDto, userId)
      if (!this.runningSessions.has(sessionId)) return // 已被停止

      session.stats.inFlight--
      session.stats.latencies.push(result.latencyMs)

      if (result.success) {
        session.stats.totalSuccess++
      } else {
        session.stats.totalFailed++
        session.stats.errors.push({ time: Date.now(), message: result.error || 'Unknown error' })
        // 只保留最近 50 条错误
        if (session.stats.errors.length > 50) {
          session.stats.errors = session.stats.errors.slice(-50)
        }
      }

      // 定期将统计更新到 MongoDB（每 10 个请求一次）
      if (session.stats.totalSent % 10 === 0) {
        this.persistStats(sessionId).catch(() => {})
      }

      // 检查是否被动完成（所有请求都收到响应了）
      if (dto.totalRequests && session.stats.totalSent >= dto.totalRequests && session.stats.inFlight <= 0) {
        this.finishSession(sessionId, userId, 'completed')
      }
    } catch (error: any) {
      if (!this.runningSessions.has(sessionId)) return
      session.stats.inFlight--
      session.stats.totalFailed++
      session.stats.errors.push({ time: Date.now(), message: error.message })
      if (session.stats.errors.length > 50) {
        session.stats.errors = session.stats.errors.slice(-50)
      }
    }
  }

  /**
   * 停止压测
   */
  async stopTest(sessionId: string, userId: string): Promise<{ status: string }> {
    const session = this.runningSessions.get(sessionId)
    if (!session) {
      throw new Error('压测会话不存在或已结束')
    }

    this.finishSession(sessionId, userId, 'stopped')
    return { status: 'stopped' }
  }

  /**
   * 结束压测会话
   */
  private async finishSession(sessionId: string, userId: string, status: 'completed' | 'stopped'): Promise<void> {
    const session = this.runningSessions.get(sessionId)
    if (!session) return

    session.stopFlag = true
    clearInterval(session.timer)
    session.stats.endTime = Date.now()

    this.logger.log(`⏹ Stress test ${status}: ${sessionId}, sent=${session.stats.totalSent}, success=${session.stats.totalSuccess}, failed=${session.stats.totalFailed}`)

    // 持久化最终状态
    await this.getCollection().updateOne(
      { sessionId },
      { $set: { status, stats: session.stats } },
    )

    this.runningSessions.delete(sessionId)
    if (this.userSessions.get(userId) === sessionId) {
      this.userSessions.delete(userId)
    }
  }

  /**
   * 持久化统计到 MongoDB
   */
  private async persistStats(sessionId: string): Promise<void> {
    const session = this.runningSessions.get(sessionId)
    if (!session) return
    await this.getCollection().updateOne(
      { sessionId },
      { $set: { stats: session.stats } },
    )
  }

  /**
   * 获取压测状态和统计
   */
  async getStatus(sessionId: string, userId: string): Promise<any> {
    // 优先从内存取（实时）
    const memSession = this.runningSessions.get(sessionId)

    // 从 MongoDB 获取会话配置
    const doc = await this.getCollection().findOne({ sessionId, userId }) as any
    if (!doc) {
      throw new Error('压测会话不存在')
    }

    const stats = memSession ? memSession.stats : doc.stats
    const status = memSession ? 'running' : doc.status

    // 计算统计指标
    const latencies = [...(stats.latencies || [])]
    latencies.sort((a: number, b: number) => a - b)

    const avgLatency = latencies.length > 0
      ? latencies.reduce((sum: number, v: number) => sum + v, 0) / latencies.length
      : 0
    const p50 = this.percentile(latencies, 50)
    const p95 = this.percentile(latencies, 95)
    const p99 = this.percentile(latencies, 99)

    const elapsed = (stats.endTime || Date.now()) - stats.startTime
    const actualRps = elapsed > 0 ? (stats.totalSuccess / (elapsed / 1000)) : 0
    const successRate = stats.totalSent > 0 ? (stats.totalSuccess / stats.totalSent * 100) : 0

    return {
      sessionId,
      status,
      config: doc.config,
      stats: {
        totalSent: stats.totalSent,
        totalSuccess: stats.totalSuccess,
        totalFailed: stats.totalFailed,
        inFlight: stats.inFlight,
        avgLatency: Math.round(avgLatency),
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99),
        actualRps: Math.round(actualRps * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        elapsedMs: elapsed,
        errors: (stats.errors || []).slice(-20),
        startTime: stats.startTime,
        endTime: stats.endTime,
      },
    }
  }

  /**
   * 获取用户历史压测记录
   */
  async getHistory(userId: string): Promise<any[]> {
    const docs = await this.getCollection()
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()

    return docs.map((doc: any) => {
      const stats = doc.stats || {}
      const latencies = [...(stats.latencies || [])]
      const elapsed = (stats.endTime || doc.createdAt) - stats.startTime
      const successRate = stats.totalSent > 0 ? (stats.totalSuccess / stats.totalSent * 100) : 0
      return {
        sessionId: doc.sessionId,
        config: doc.config,
        status: doc.status,
        totalSent: stats.totalSent || 0,
        totalSuccess: stats.totalSuccess || 0,
        totalFailed: stats.totalFailed || 0,
        successRate: Math.round(successRate * 100) / 100,
        elapsedMs: elapsed,
        createdAt: doc.createdAt,
      }
    })
  }

  /**
   * 计算百分位数
   */
  private percentile(sortedArr: number[], p: number): number {
    if (sortedArr.length === 0) return 0
    const idx = Math.ceil(sortedArr.length * p / 100) - 1
    return sortedArr[Math.max(0, idx)]
  }
}

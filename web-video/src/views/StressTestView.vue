<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { stressTestApi, userConfigApi, type StressTestConfig, type StressTestStatus, type StressTestHistoryItem, type ServiceConfig } from '@/api'

// 表单
const form = ref<StressTestConfig>({
  model: 'gemini-3-pro-image-preview',
  channel: undefined,
  rpm: 10,
  totalRequests: undefined,
  prompts: [''],
  aspectRatio: '1:1',
  imageSize: '1K',
  size: '1024x1024',
  n: 1,
})
const modelCustom = ref(false)
const unlimitedMode = ref(false)

// 运行状态
const currentSessionId = ref<string | null>(null)
const currentStatus = ref<StressTestStatus | null>(null)
const isStarting = ref(false)
const isStopping = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

// 历史
const history = ref<StressTestHistoryItem[]>([])

// API 配置
const apiConfig = ref<Record<string, ServiceConfig>>({})
const apiEditMode = ref(false)
const apiEditForm = ref<ServiceConfig>({ server: '', key: '' })
const apiSaving = ref(false)
const apiMsg = ref('')

// 判断是否为 Grok/GPT 模型
const isGrokModel = computed(() => {
  const m = form.value.model
  return (m.startsWith('grok-') && m.includes('image')) || m.startsWith('gpt-image')
})

// 当前模型对应的服务类型
const activeApiType = computed(() => isGrokModel.value ? 'grokImage' : 'geminiImage')

// 当前模型对应的 API 配置
const activeApiConfig = computed(() => apiConfig.value[activeApiType.value] || { server: '', key: '' })

// 加载用户 API 配置
const loadApiConfig = async () => {
  try {
    const res = await userConfigApi.getConfig()
    apiConfig.value = res.data.data as any
  } catch (e) {
    console.error('加载 API 配置失败', e)
  }
}

// 进入编辑模式
const enterApiEdit = async () => {
  try {
    const res = await userConfigApi.getFullConfig()
    const full = res.data.data as any
    const cfg = full[activeApiType.value] || { server: '', key: '' }
    apiEditForm.value = { server: cfg.server || '', key: cfg.key || '' }
    apiEditMode.value = true
    apiMsg.value = ''
  } catch (e) {
    console.error('加载完整配置失败', e)
  }
}

// 保存 API 配置
const saveApiConfig = async () => {
  apiSaving.value = true
  apiMsg.value = ''
  try {
    await userConfigApi.updateServiceConfig(activeApiType.value as any, apiEditForm.value)
    apiEditMode.value = false
    apiMsg.value = '✅ 保存成功'
    loadApiConfig()
    setTimeout(() => { apiMsg.value = '' }, 2000)
  } catch (e: any) {
    apiMsg.value = '❌ ' + (e.response?.data?.message || '保存失败')
  } finally {
    apiSaving.value = false
  }
}

// 取消编辑
const cancelApiEdit = () => {
  apiEditMode.value = false
  apiMsg.value = ''
}

// 加载历史
const loadHistory = async () => {
  try {
    const res = await stressTestApi.getHistory()
    history.value = res.data.data
  } catch (e) {
    console.error('加载历史失败', e)
  }
}

// 添加提示词
const addPrompt = () => {
  form.value.prompts.push('')
}

// 删除提示词
const removePrompt = (index: number) => {
  if (form.value.prompts.length <= 1) return
  form.value.prompts.splice(index, 1)
}

// 启动压测
const startTest = async () => {
  // 校验
  const validPrompts = form.value.prompts.filter(p => p.trim())
  if (validPrompts.length === 0) {
    alert('至少需要输入一条提示词')
    return
  }

  if (!confirm('⚠️ 压力测试将产生真实 API 调用费用，确定要开始吗？')) return

  isStarting.value = true
  try {
    const config: StressTestConfig = {
      model: form.value.model,
      rpm: form.value.rpm,
      prompts: validPrompts,
      totalRequests: unlimitedMode.value ? undefined : (form.value.totalRequests || undefined),
    }

    // 根据模型类型设置参数
    if (isGrokModel.value) {
      config.channel = form.value.channel
      config.size = form.value.size
      config.n = form.value.n
    } else {
      config.aspectRatio = form.value.aspectRatio
      config.imageSize = form.value.imageSize
    }

    const res = await stressTestApi.start(config)
    currentSessionId.value = res.data.data.sessionId
    startPolling()
  } catch (e: any) {
    alert(e.response?.data?.message || e.message || '启动失败')
  } finally {
    isStarting.value = false
  }
}

// 停止压测
const stopTest = async () => {
  if (!currentSessionId.value) return
  isStopping.value = true
  try {
    await stressTestApi.stop(currentSessionId.value)
  } catch (e: any) {
    alert(e.response?.data?.message || e.message || '停止失败')
  } finally {
    isStopping.value = false
  }
}

// 轮询状态
const startPolling = () => {
  stopPolling()
  pollStatus()
  pollTimer = setInterval(pollStatus, 2000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const pollStatus = async () => {
  if (!currentSessionId.value) return
  try {
    const res = await stressTestApi.getStatus(currentSessionId.value)
    currentStatus.value = res.data.data
    if (res.data.data.status !== 'running') {
      stopPolling()
      loadHistory()
    }
  } catch (e) {
    console.error('轮询状态失败', e)
  }
}

// 查看历史记录详情
const viewHistoryDetail = async (sessionId: string) => {
  currentSessionId.value = sessionId
  try {
    const res = await stressTestApi.getStatus(sessionId)
    currentStatus.value = res.data.data
    if (res.data.data.status === 'running') {
      startPolling()
    }
  } catch (e) {
    console.error('获取详情失败', e)
  }
}

// 格式化时间
const formatDuration = (ms: number) => {
  if (!ms) return '0s'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

const formatTime = (ts: number) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}

const formatLatency = (ms: number) => {
  if (!ms) return '0ms'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

// 是否正在运行
const isRunning = computed(() => currentStatus.value?.status === 'running')

// 下载压测报告
const downloadReport = (data: StressTestStatus, format: 'json' | 'csv' = 'csv') => {
  const ts = new Date(data.stats.startTime).toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `stress-test-${data.config.model}-${ts}`

  if (format === 'json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    triggerDownload(blob, `${filename}.json`)
    return
  }

  // CSV 报告
  const lines: string[] = []
  lines.push('=== RPM 压力测试报告 ===')
  lines.push('')
  lines.push('[测试配置]')
  lines.push(`模型,${data.config.model}`)
  if (data.config.channel) lines.push(`渠道,${data.config.channel}`)
  lines.push(`RPM,${data.config.rpm}`)
  lines.push(`总请求数,${data.config.totalRequests || '不限制'}`)
  lines.push(`提示词数量,${data.config.prompts?.length || 0}`)
  if (data.config.aspectRatio) lines.push(`画面比例,${data.config.aspectRatio}`)
  if (data.config.imageSize) lines.push(`图片尺寸,${data.config.imageSize}`)
  if (data.config.size) lines.push(`图片尺寸,${data.config.size}`)
  lines.push('')
  lines.push('[测试结果]')
  lines.push(`状态,${data.status}`)
  lines.push(`开始时间,${formatTime(data.stats.startTime)}`)
  if (data.stats.endTime) lines.push(`结束时间,${formatTime(data.stats.endTime)}`)
  lines.push(`运行时长,${formatDuration(data.stats.elapsedMs)}`)
  lines.push('')
  lines.push('[请求统计]')
  lines.push(`总发送,${data.stats.totalSent}`)
  lines.push(`成功,${data.stats.totalSuccess}`)
  lines.push(`失败,${data.stats.totalFailed}`)
  lines.push(`成功率,${data.stats.successRate}%`)
  lines.push(`实际 RPS,${data.stats.actualRps}`)
  lines.push('')
  lines.push('[延迟统计]')
  lines.push(`平均延迟,${formatLatency(data.stats.avgLatency)}`)
  lines.push(`P50,${formatLatency(data.stats.p50)}`)
  lines.push(`P95,${formatLatency(data.stats.p95)}`)
  lines.push(`P99,${formatLatency(data.stats.p99)}`)

  if (data.config.prompts?.length) {
    lines.push('')
    lines.push('[提示词列表]')
    data.config.prompts.forEach((p, i) => {
      lines.push(`${i + 1},"${p.replace(/"/g, '""')}"`)
    })
  }

  if (data.stats.errors?.length) {
    lines.push('')
    lines.push('[错误日志]')
    lines.push('时间,错误信息')
    data.stats.errors.forEach(err => {
      lines.push(`${new Date(err.time).toLocaleTimeString('zh-CN')},"${err.message.replace(/"/g, '""')}"`)
    })
  }

  // BOM + content for Excel compatibility
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, `${filename}.csv`)
}

const downloadCurrentReport = (format: 'json' | 'csv' = 'csv') => {
  if (!currentStatus.value) return
  downloadReport(currentStatus.value, format)
}

const downloadHistoryReport = async (sessionId: string, format: 'json' | 'csv' = 'csv') => {
  try {
    const res = await stressTestApi.getStatus(sessionId)
    downloadReport(res.data.data, format)
  } catch (e) {
    console.error('获取报告数据失败', e)
    alert('获取报告数据失败')
  }
}

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(() => {
  loadHistory()
  loadApiConfig()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="container">
    <h2 class="page-title">⚡ RPM 压力测试</h2>
    <p class="page-desc">测试图片生成接口的上游承受能力，自定义 RPM 批量发送生图请求</p>

    <div class="grid-2">
      <!-- 左侧：配置面板 -->
      <div class="card">
        <h3 class="card-title">测试配置</h3>

        <!-- API 配置 -->
        <div class="api-config-section">
          <div class="api-config-header">
            <span class="api-type-badge">{{ isGrokModel ? '🔵 Grok/GPT Image' : '🟢 Gemini Image' }}</span>
            <button v-if="!apiEditMode" class="btn-text" @click="enterApiEdit">✏️ 编辑</button>
          </div>
          <template v-if="!apiEditMode">
            <div class="api-config-row">
              <span class="api-config-label">Base URL</span>
              <span class="api-config-value">{{ activeApiConfig.server || '(未配置，使用全局)' }}</span>
            </div>
            <div class="api-config-row">
              <span class="api-config-label">API Key</span>
              <span class="api-config-value">{{ activeApiConfig.key || '(未配置，使用全局)' }}</span>
            </div>
          </template>
          <template v-else>
            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label">Base URL</label>
              <input v-model="apiEditForm.server" class="form-input" placeholder="如 https://generativelanguage.googleapis.com" />
            </div>
            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label">API Key</label>
              <input v-model="apiEditForm.key" class="form-input" type="password" placeholder="输入 API Key" />
            </div>
            <div class="api-edit-actions">
              <button class="btn btn-primary btn-sm" :disabled="apiSaving" @click="saveApiConfig">{{ apiSaving ? '保存中...' : '保存' }}</button>
              <button class="btn btn-outline btn-sm" @click="cancelApiEdit">取消</button>
            </div>
          </template>
          <div v-if="apiMsg" class="api-msg">{{ apiMsg }}</div>
        </div>

        <!-- 模型选择 -->
        <div class="form-group">
          <label class="form-label">
            模型
            <button class="btn-text" @click="modelCustom = !modelCustom">
              {{ modelCustom ? '选择模型' : '自定义' }}
            </button>
          </label>
          <input v-if="modelCustom" v-model="form.model" class="form-input" placeholder="输入模型名称" />
          <select v-else v-model="form.model" class="form-select">
            <optgroup label="Gemini">
              <option value="gemini-3-pro-image-preview">gemini-3-pro-image-preview</option>
              <option value="gemini-3.1-flash-image-preview">gemini-3.1-flash-image-preview</option>
              <option value="gemini-2.5-flash-image-vip">gemini-2.5-flash-image-vip</option>
              <option value="gemini-3-pro-image-preview-vip">gemini-3-pro-image-preview-vip</option>
              <option value="gemini-3.1-flash-image-preview-vip">gemini-3.1-flash-image-preview-vip</option>
            </optgroup>
            <optgroup label="Grok">
              <option value="grok-4-1-image">grok-4-1-image</option>
              <option value="grok-4-2-image">grok-4-2-image</option>
              <option value="grok-3-image">grok-3-image</option>
            </optgroup>
            <optgroup label="GPT">
              <option value="gpt-image-1.5">gpt-image-1.5</option>
            </optgroup>
          </select>
        </div>

        <!-- 渠道（Grok/GPT 才显示） -->
        <div v-if="isGrokModel" class="form-group">
          <label class="form-label">渠道</label>
          <select v-model="form.channel" class="form-select">
            <option value="aifast">aifast</option>
            <option value="xiaohumini">xiaohumini</option>
          </select>
        </div>

        <!-- RPM -->
        <div class="form-group">
          <label class="form-label">RPM（每分钟请求数）</label>
          <input v-model.number="form.rpm" type="number" min="1" max="600" class="form-input" />
        </div>

        <!-- 总请求数 -->
        <div class="form-group">
          <label class="form-label">
            总请求数
            <label class="checkbox-label">
              <input v-model="unlimitedMode" type="checkbox" />
              不限制（手动停止）
            </label>
          </label>
          <input
            v-if="!unlimitedMode"
            v-model.number="form.totalRequests"
            type="number"
            min="1"
            class="form-input"
            placeholder="如：100"
          />
        </div>

        <!-- 图片参数 -->
        <div v-if="!isGrokModel" class="form-group">
          <label class="form-label">画面比例</label>
          <select v-model="form.aspectRatio" class="form-select">
            <option value="1:1">1:1</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="4:3">4:3</option>
            <option value="3:4">3:4</option>
          </select>
        </div>
        <div v-if="!isGrokModel" class="form-group">
          <label class="form-label">图片尺寸</label>
          <select v-model="form.imageSize" class="form-select">
            <option value="0.5K">0.5K</option>
            <option value="1K">1K</option>
            <option value="2K">2K</option>
            <option value="4K">4K</option>
          </select>
        </div>
        <div v-if="isGrokModel" class="form-group">
          <label class="form-label">图片尺寸</label>
          <select v-model="form.size" class="form-select">
            <option value="1024x1024">1024x1024</option>
            <option value="1536x1024">1536x1024</option>
            <option value="1024x1536">1024x1536</option>
          </select>
        </div>
        <div v-if="isGrokModel" class="form-group">
          <label class="form-label">每次生成数量</label>
          <input v-model.number="form.n" type="number" min="1" max="4" class="form-input" />
        </div>

        <!-- 提示词列表 -->
        <div class="form-group">
          <label class="form-label">
            提示词列表
            <span class="text-muted">(循环使用)</span>
          </label>
          <div v-for="(_, idx) in form.prompts" :key="idx" class="prompt-row">
            <textarea
              v-model="form.prompts[idx]"
              class="form-textarea"
              :placeholder="`提示词 ${idx + 1}`"
              rows="2"
            />
            <button v-if="form.prompts.length > 1" class="btn-icon btn-danger-icon" @click="removePrompt(idx)" title="删除">✕</button>
          </div>
          <button class="btn btn-outline btn-sm" @click="addPrompt">+ 添加提示词</button>
        </div>

        <!-- 操作按钮 -->
        <div class="form-actions">
          <button
            class="btn btn-primary"
            :disabled="isStarting || isRunning"
            @click="startTest"
          >
            {{ isStarting ? '启动中...' : '▶ 开始测试' }}
          </button>
          <button
            v-if="isRunning"
            class="btn btn-danger"
            :disabled="isStopping"
            @click="stopTest"
          >
            {{ isStopping ? '停止中...' : '⏹ 停止测试' }}
          </button>
        </div>
      </div>

      <!-- 右侧：实时统计面板 -->
      <div class="card">
        <h3 class="card-title">实时统计</h3>

        <template v-if="currentStatus">
          <!-- 状态徽章 + 下载按钮 -->
          <div class="status-row">
            <span class="status-badge" :class="`status-${currentStatus.status}`">
              {{ currentStatus.status === 'running' ? '🔄 运行中' :
                 currentStatus.status === 'completed' ? '✅ 已完成' :
                 currentStatus.status === 'stopped' ? '⏹ 已停止' : '❌ 错误' }}
            </span>
            <span class="text-muted">{{ currentStatus.config?.model }}</span>
            <div v-if="currentStatus.status !== 'running'" class="download-btns">
              <button class="btn btn-outline btn-sm" @click="downloadCurrentReport('csv')" title="下载 CSV 报告">📊 CSV</button>
              <button class="btn btn-outline btn-sm" @click="downloadCurrentReport('json')" title="下载 JSON 报告">📋 JSON</button>
            </div>
          </div>

          <!-- 核心指标卡片 -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">{{ currentStatus.stats.totalSent }}</div>
              <div class="stat-label">已发送</div>
            </div>
            <div class="stat-card stat-success">
              <div class="stat-value">{{ currentStatus.stats.totalSuccess }}</div>
              <div class="stat-label">成功</div>
            </div>
            <div class="stat-card stat-error">
              <div class="stat-value">{{ currentStatus.stats.totalFailed }}</div>
              <div class="stat-label">失败</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ currentStatus.stats.inFlight }}</div>
              <div class="stat-label">进行中</div>
            </div>
          </div>

          <!-- 延迟指标 -->
          <div class="metrics-section">
            <h4 class="section-title">延迟指标</h4>
            <div class="metrics-grid">
              <div class="metric-item">
                <span class="metric-label">平均</span>
                <span class="metric-value">{{ formatLatency(currentStatus.stats.avgLatency) }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">P50</span>
                <span class="metric-value">{{ formatLatency(currentStatus.stats.p50) }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">P95</span>
                <span class="metric-value">{{ formatLatency(currentStatus.stats.p95) }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">P99</span>
                <span class="metric-value">{{ formatLatency(currentStatus.stats.p99) }}</span>
              </div>
            </div>
          </div>

          <!-- 吞吐量 -->
          <div class="metrics-section">
            <h4 class="section-title">吞吐量</h4>
            <div class="metrics-grid">
              <div class="metric-item">
                <span class="metric-label">实际 RPS</span>
                <span class="metric-value">{{ currentStatus.stats.actualRps }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">成功率</span>
                <span class="metric-value" :class="currentStatus.stats.successRate >= 95 ? 'text-success' : currentStatus.stats.successRate >= 80 ? 'text-warning' : 'text-error'">
                  {{ currentStatus.stats.successRate }}%
                </span>
              </div>
              <div class="metric-item">
                <span class="metric-label">运行时长</span>
                <span class="metric-value">{{ formatDuration(currentStatus.stats.elapsedMs) }}</span>
              </div>
            </div>
          </div>

          <!-- 进度条（有总数时显示） -->
          <div v-if="currentStatus.config?.totalRequests" class="metrics-section">
            <h4 class="section-title">进度</h4>
            <div class="progress-bar-container">
              <div class="progress-bar" :style="{ width: Math.min(100, currentStatus.stats.totalSent / currentStatus.config.totalRequests * 100) + '%' }"></div>
            </div>
            <div class="text-muted text-center">{{ currentStatus.stats.totalSent }} / {{ currentStatus.config.totalRequests }}</div>
          </div>

          <!-- 最近错误 -->
          <div v-if="currentStatus.stats.errors?.length > 0" class="metrics-section">
            <h4 class="section-title">最近错误</h4>
            <div class="error-log">
              <div v-for="(err, idx) in currentStatus.stats.errors.slice().reverse().slice(0, 10)" :key="idx" class="error-item">
                <span class="error-time">{{ new Date(err.time).toLocaleTimeString('zh-CN') }}</span>
                <span class="error-msg">{{ err.message }}</span>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="empty-state">
          <p>启动压力测试后，统计数据将在此处实时展示</p>
        </div>
      </div>
    </div>

    <!-- 历史记录 -->
    <div class="card" style="margin-top: 24px;">
      <h3 class="card-title">历史记录</h3>
      <div v-if="history.length === 0" class="empty-state">
        <p>暂无压测历史记录</p>
      </div>
      <div v-else class="history-table-container">
        <table class="history-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>模型</th>
              <th>RPM</th>
              <th>总请求</th>
              <th>成功/失败</th>
              <th>成功率</th>
              <th>耗时</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in history" :key="item.sessionId">
              <td>{{ formatTime(item.createdAt) }}</td>
              <td class="text-mono">{{ item.config?.model || '-' }}</td>
              <td>{{ item.config?.rpm || '-' }}</td>
              <td>{{ item.totalSent }}</td>
              <td>
                <span class="text-success">{{ item.totalSuccess }}</span> /
                <span class="text-error">{{ item.totalFailed }}</span>
              </td>
              <td :class="item.successRate >= 95 ? 'text-success' : item.successRate >= 80 ? 'text-warning' : 'text-error'">
                {{ item.successRate }}%
              </td>
              <td>{{ formatDuration(item.elapsedMs) }}</td>
              <td>
                <span class="status-badge status-sm" :class="`status-${item.status}`">{{ item.status }}</span>
              </td>
              <td class="action-btns">
                <button class="btn btn-outline btn-sm" @click="viewHistoryDetail(item.sessionId)">详情</button>
                <button class="btn btn-outline btn-sm" @click="downloadHistoryReport(item.sessionId, 'csv')" title="下载 CSV">📊</button>
                <button class="btn btn-outline btn-sm" @click="downloadHistoryReport(item.sessionId, 'json')" title="下载 JSON">📋</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.page-title {
  color: var(--text);
  margin-bottom: 4px;
}

.page-desc {
  color: var(--text-muted);
  margin-bottom: 24px;
  font-size: 0.9em;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 900px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}

.card-title {
  color: var(--text);
  font-size: 1.1em;
  margin-bottom: 16px;
}

/* API 配置区域 */
.api-config-section {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 20px;
}

.api-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.api-type-badge {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--text);
}

.api-config-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 4px 0;
  font-size: 0.85em;
}

.api-config-label {
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 65px;
}

.api-config-value {
  color: var(--text);
  word-break: break-all;
  font-family: monospace;
  font-size: 0.9em;
}

.api-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.api-msg {
  font-size: 0.8em;
  margin-top: 6px;
  color: var(--text-muted);
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 0.9em;
  margin-bottom: 6px;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.9em;
  box-sizing: border-box;
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.btn-text {
  background: none;
  border: none;
  color: var(--primary);
  cursor: pointer;
  font-size: 0.8em;
  padding: 0;
}

.btn-text:hover {
  text-decoration: underline;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85em;
  color: var(--text-muted);
  cursor: pointer;
  font-weight: normal;
}

.prompt-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: flex-start;
}

.prompt-row .form-textarea {
  flex: 1;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 1em;
}

.btn-danger-icon {
  color: var(--error);
}

.btn-danger-icon:hover {
  background: rgba(239, 68, 68, 0.15);
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-danger {
  background: var(--error);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.btn-outline:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.btn-sm {
  padding: 4px 12px;
  font-size: 0.8em;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

/* 实时统计 */
.status-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.download-btns {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.action-btns {
  display: flex;
  gap: 4px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85em;
  font-weight: 500;
}

.status-sm {
  padding: 2px 8px;
  font-size: 0.75em;
}

.status-running {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
}

.status-completed {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.status-stopped {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.status-error {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--bg-input);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.stat-value {
  font-size: 1.5em;
  font-weight: 700;
  color: var(--text);
}

.stat-success .stat-value {
  color: var(--success);
}

.stat-error .stat-value {
  color: var(--error);
}

.stat-label {
  font-size: 0.8em;
  color: var(--text-muted);
  margin-top: 4px;
}

.metrics-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 0.85em;
  color: var(--text-muted);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-input);
  border-radius: 6px;
}

.metric-label {
  font-size: 0.8em;
  color: var(--text-muted);
}

.metric-value {
  font-size: 0.95em;
  font-weight: 600;
  color: var(--text);
}

.text-success {
  color: var(--success) !important;
}

.text-warning {
  color: var(--warning) !important;
}

.text-error {
  color: var(--error) !important;
}

.text-muted {
  color: var(--text-muted);
}

.text-center {
  text-align: center;
}

.text-mono {
  font-family: monospace;
  font-size: 0.85em;
}

/* 进度条 */
.progress-bar-container {
  width: 100%;
  height: 8px;
  background: var(--bg-input);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-bar {
  height: 100%;
  background: var(--primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* 错误日志 */
.error-log {
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-input);
  border-radius: 8px;
  padding: 8px;
}

.error-item {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  font-size: 0.8em;
  border-bottom: 1px solid rgba(71, 85, 105, 0.3);
}

.error-item:last-child {
  border-bottom: none;
}

.error-time {
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.error-msg {
  color: var(--error);
  word-break: break-all;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
}

/* 历史表格 */
.history-table-container {
  overflow-x: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85em;
}

.history-table th,
.history-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.history-table th {
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.9em;
}

.history-table td {
  color: var(--text);
}

.history-table tbody tr:hover {
  background: rgba(99, 102, 241, 0.05);
}
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { soraApi, veoApi, grokApi, doubaoApi, userConfigApi } from '@/api'
import { type VideoTask, useVideoStore } from '@/stores/video'

const store = useVideoStore()

const platform = ref<'sora' | 'veo' | 'grok' | 'doubao'>('sora')
const isLoading = ref(false)

const soraForm = ref({
  model: 'sora-2',
  prompt: '',
  size: '1280x720' as '1280x720' | '720x1280',
  seconds: 10,
})

// Sora 模型和时长的自定义输入状态
const soraModelCustom = ref(false)
const soraDurationCustom = ref(false)

// Sora 参考图
const soraReferenceFiles = ref<File[]>([])
const soraFileInput = ref<HTMLInputElement | null>(null)

const veoForm = ref({
  model: 'veo_3_1-fast',
  prompt: '',
  size: '1280x720' as '1280x720' | '720x1280',
  seconds: 8,
})

// VEO 模型自定义输入状态
const veoModelCustom = ref(false)

// VEO 参考图
const veoReferenceFiles = ref<File[]>([])
const veoFileInput = ref<HTMLInputElement | null>(null)

// Grok 表单
const grokForm = ref({
  model: 'grok-video-3',
  prompt: '',
  aspect_ratio: '3:2' as '2:3' | '3:2' | '1:1',
  seconds: 6,
  size: '720P' as '720P' | '1080P',
})

// Grok 模型自定义输入状态
const grokModelCustom = ref(false)

// Grok 参考图
const grokReferenceFiles = ref<File[]>([])
const grokFileInput = ref<HTMLInputElement | null>(null)

// 豆包表单
const doubaoForm = ref({
  model: 'doubao-seedance-1-5-pro_720p',
  prompt: '',
  size: '16:9',
  seconds: 5,
})

// 豆包模型自定义输入状态
const doubaoModelCustom = ref(false)
const doubaoDurationCustom = ref(false)

// 豆包首帧/尾帧图片
const doubaoFirstFrame = ref<File | null>(null)
const doubaoLastFrame = ref<File | null>(null)
const doubaoFirstFrameInput = ref<HTMLInputElement | null>(null)
const doubaoLastFrameInput = ref<HTMLInputElement | null>(null)

// API 快捷配置
const apiConfigVisible = ref(false)
const apiConfigSaving = ref(false)
const apiConfigMsg = ref('')
const apiConfig = ref<Record<string, { server: string; key: string; characterServer?: string; characterKey?: string }>>({
  sora: { server: '', key: '', characterServer: '', characterKey: '' },
  veo: { server: '', key: '' },
  grok: { server: '', key: '' },
  doubao: { server: '', key: '' },
})

const loadApiConfig = async () => {
  try {
    const response = await userConfigApi.getFullConfig()
    const data = response.data.data
    for (const svc of ['sora', 'veo', 'grok', 'doubao'] as const) {
      if (data[svc]) {
        apiConfig.value[svc] = { server: data[svc].server || '', key: data[svc].key || '' }
      }
    }
    // Sora 角色 API 配置
    if (data.sora) {
      apiConfig.value.sora.characterServer = data.sora.characterServer || ''
      apiConfig.value.sora.characterKey = data.sora.characterKey || ''
    }
  } catch (e) {
    console.error('加载 API 配置失败', e)
  }
}

const saveApiConfig = async () => {
  const svc = platform.value
  apiConfigSaving.value = true
  try {
    await userConfigApi.updateServiceConfig(svc, apiConfig.value[svc])
    apiConfigMsg.value = '✅ 保存成功'
    setTimeout(() => { apiConfigMsg.value = '' }, 2000)
  } catch (e: any) {
    apiConfigMsg.value = '❌ 保存失败'
    setTimeout(() => { apiConfigMsg.value = '' }, 3000)
  } finally {
    apiConfigSaving.value = false
  }
}

const statusText: Record<string, string> = {
  queued: '排队中',
  processing: '生成中',
  completed: '已完成',
  failed: '失败',
}

// 检查当前平台 API 是否已配置
const isApiConfigMissing = computed(() => {
  const cfg = apiConfig.value[platform.value]
  return !cfg || !cfg.server || !cfg.key
})

const recentTasks = computed(() => store.tasks.slice(0, 5))

// 创建视频
const createVideo = async () => {
  const prompt = platform.value === 'sora'
    ? soraForm.value.prompt
    : platform.value === 'veo'
      ? veoForm.value.prompt
      : platform.value === 'doubao'
        ? doubaoForm.value.prompt
        : grokForm.value.prompt
  if (!prompt.trim()) {
    alert('请输入提示词')
    return
  }

  isLoading.value = true

  try {
    let response: any
    let task: VideoTask

    if (platform.value === 'sora') {
      response = await soraApi.createVideo({
        model: soraForm.value.model,
        prompt: soraForm.value.prompt,
        size: soraForm.value.size,
        seconds: soraForm.value.seconds,
      }, soraReferenceFiles.value.length > 0 ? soraReferenceFiles.value : undefined)

      task = {
        id: response.data.id,
        model: soraForm.value.model,
        prompt: soraForm.value.prompt,
        status: 'queued',
        progress: 0,
        created_at: Date.now(),
        platform: 'sora',
      }
    }
    else if (platform.value === 'veo') {
      response = await veoApi.createVideo({
        model: veoForm.value.model,
        prompt: veoForm.value.prompt,
        size: veoForm.value.size,
        seconds: veoForm.value.seconds,
      }, veoReferenceFiles.value)

      task = {
        id: response.data.id,
        model: veoForm.value.model,
        prompt: veoForm.value.prompt,
        status: 'queued',
        progress: 0,
        created_at: Date.now(),
        platform: 'veo',
      }
    }
    else if (platform.value === 'doubao') {
      // 豆包
      response = await doubaoApi.createVideo({
        model: doubaoForm.value.model,
        prompt: doubaoForm.value.prompt,
        size: doubaoForm.value.size,
        seconds: doubaoForm.value.seconds,
      }, doubaoFirstFrame.value || undefined, doubaoLastFrame.value || undefined)

      task = {
        id: response.data.id,
        model: doubaoForm.value.model,
        prompt: doubaoForm.value.prompt,
        status: 'queued',
        progress: 0,
        created_at: Date.now(),
        platform: 'doubao',
      }
    }
    else {
      // Grok
      response = await grokApi.createVideo({
        model: grokForm.value.model,
        prompt: grokForm.value.prompt,
        aspect_ratio: grokForm.value.aspect_ratio,
        seconds: grokForm.value.seconds,
        size: grokForm.value.size,
      }, grokReferenceFiles.value)

      task = {
        id: response.data.id,
        model: grokForm.value.model,
        prompt: grokForm.value.prompt,
        status: 'queued',
        progress: 0,
        created_at: Date.now(),
        platform: 'grok',
      }
    }

    store.addTask(task)

    // 清空表单
    if (platform.value === 'sora') {
      soraForm.value.prompt = ''
      soraReferenceFiles.value = []
    }
    else if (platform.value === 'veo') {
      veoForm.value.prompt = ''
      veoReferenceFiles.value = []
    }
    else if (platform.value === 'doubao') {
      doubaoForm.value.prompt = ''
      doubaoFirstFrame.value = null
      doubaoLastFrame.value = null
    }
    else {
      grokForm.value.prompt = ''
      grokReferenceFiles.value = []
    }

    // 开始轮询
    pollTaskStatus(task.id, task.platform)
  }
  catch (error: any) {
    console.error('创建失败', error)
    alert(`创建失败: ${error.response?.data?.message || error.message}`)
  }
  finally {
    isLoading.value = false
  }
}

// Sora 参考图处理函数
const handleSoraFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files) {
    const newFiles = Array.from(input.files)
    soraReferenceFiles.value = [...soraReferenceFiles.value, ...newFiles]
  }
  input.value = ''
}

// VEO 参考图处理函数
const handleVeoFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files) {
    const newFiles = Array.from(input.files)
    veoReferenceFiles.value = [...veoReferenceFiles.value, ...newFiles]
  }
  // 清空 input 以便重复选择相同文件
  input.value = ''
}

const removeVeoFile = (index: number) => {
  veoReferenceFiles.value.splice(index, 1)
}

const getFilePreviewUrl = (file: File) => {
  return URL.createObjectURL(file)
}

// Grok 参考图处理函数
const handleGrokFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files) {
    const newFiles = Array.from(input.files)
    grokReferenceFiles.value = [...grokReferenceFiles.value, ...newFiles]
  }
  input.value = ''
}

const removeGrokFile = (index: number) => {
  grokReferenceFiles.value.splice(index, 1)
}

// 豆包首帧图处理
const handleDoubaoFirstFrame = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    doubaoFirstFrame.value = input.files[0]
  }
  input.value = ''
}

// 豆包尾帧图处理
const handleDoubaoLastFrame = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    doubaoLastFrame.value = input.files[0]
  }
  input.value = ''
}

// 轮询任务状态
const pollTaskStatus = async (taskId: string, taskPlatform: 'sora' | 'veo' | 'grok' | 'doubao') => {
  const maxAttempts = 120
  let attempts = 0

  const poll = async () => {
    if (attempts >= maxAttempts)
      return
    attempts++

    try {
      const response = taskPlatform === 'sora'
        ? await soraApi.queryVideo(taskId)
        : taskPlatform === 'veo'
          ? await veoApi.queryVideo(taskId)
          : taskPlatform === 'doubao'
            ? await doubaoApi.queryVideo(taskId)
            : await grokApi.queryVideo(taskId)

      const data = response.data

      if (data.status === 'completed') {
        store.updateTask(taskId, {
          status: 'completed',
          progress: 100,
          video_url: data.video_url || data.url,
        })
        return
      }
      else if (data.status === 'failed') {
        store.updateTask(taskId, { status: 'failed' })
        return
      }
      else {
        store.updateTask(taskId, {
          status: 'processing',
          progress: data.progress || 0,
        })
        setTimeout(poll, 3000)
      }
    }
    catch (error) {
      console.error('查询失败', error)
      setTimeout(poll, 5000)
    }
  }

  poll()
}

// 恢复未完成任务的轮询
onMounted(async () => {
  // 加载用户 API 配置
  await loadApiConfig()

  // 先从数据库加载任务列表
  await store.loadTasks()

  // 恢复未完成任务的轮询
  store.tasks.forEach((task) => {
    if (task.status === 'queued' || task.status === 'processing')
      pollTaskStatus(task.id, task.platform)
  })
})
</script>

<template>
  <div class="home">
    <!-- 平台选择 -->
    <div class="tabs">
      <button
        class="tab"
        :class="{ active: platform === 'sora' }"
        @click="platform = 'sora'"
      >
        🎬 Sora (OpenAI)
      </button>
      <button
        class="tab"
        :class="{ active: platform === 'veo' }"
        @click="platform = 'veo'"
      >
        🎥 VEO (Google)
      </button>
      <button
        class="tab"
        :class="{ active: platform === 'grok' }"
        @click="platform = 'grok'"
      >
        ⚡ Grok (xAI)
      </button>
      <button
        class="tab"
        :class="{ active: platform === 'doubao' }"
        @click="platform = 'doubao'"
      >
        🫘 豆包 (Doubao)
      </button>
    </div>

    <div class="grid grid-2">
      <!-- 左侧：输入表单 -->
      <div class="card">
        <h2 class="card-title">
          {{ platform === 'sora' ? '🎨 Sora 视频生成' : platform === 'veo' ? '🎥 VEO 视频生成' : platform === 'grok' ? '⚡ Grok 视频生成' : '🫘 豆包视频生成' }}
        </h2>

        <!-- API 快捷配置 -->
        <div v-if="isApiConfigMissing" class="api-config-warning" @click="apiConfigVisible = true">
          ⚠️ 当前平台尚未配置 API 地址或密钥，请先展开下方配置并填写
        </div>
        <div class="api-config-section">
          <button type="button" class="api-config-toggle" @click="apiConfigVisible = !apiConfigVisible">
            ⚙️ API 配置
            <span class="toggle-arrow">{{ apiConfigVisible ? '▲' : '▼' }}</span>
          </button>
          <div v-if="apiConfigVisible" class="api-config-form">
            <div class="api-config-row">
              <label class="api-config-label">API 地址</label>
              <input
                v-model="apiConfig[platform].server"
                type="text"
                class="form-input"
                placeholder="https://api.example.com"
              >
            </div>
            <div class="api-config-row">
              <label class="api-config-label">API 密钥</label>
              <input
                v-model="apiConfig[platform].key"
                type="password"
                class="form-input"
                placeholder="sk-..."
              >
            </div>
            <!-- Sora 角色 API 配置 -->
            <template v-if="platform === 'sora'">
              <div class="api-config-divider">角色 API（可选）</div>
              <div class="api-config-row">
                <label class="api-config-label">角色地址</label>
                <input
                  v-model="apiConfig.sora.characterServer"
                  type="text"
                  class="form-input"
                  placeholder="角色 API 地址（留空则使用主地址）"
                >
              </div>
              <div class="api-config-row">
                <label class="api-config-label">角色密钥</label>
                <input
                  v-model="apiConfig.sora.characterKey"
                  type="password"
                  class="form-input"
                  placeholder="角色 API 密钥（留空则使用主密钥）"
                >
              </div>
            </template>
            <div class="api-config-actions">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="apiConfigSaving"
                @click="saveApiConfig"
              >
                {{ apiConfigSaving ? '保存中...' : '💾 保存配置' }}
              </button>
              <span v-if="apiConfigMsg" class="api-config-msg">{{ apiConfigMsg }}</span>
            </div>
          </div>
        </div>

        <!-- Sora 表单 -->
        <template v-if="platform === 'sora'">
          <div class="form-group">
            <label class="form-label">模型</label>
            <div class="input-with-toggle">
              <select
                v-if="!soraModelCustom"
                v-model="soraForm.model"
                class="form-select"
              >
                <option value="sora-2">
                  sora-2
                </option>
                <option value="sora-2-pro">
                  sora-2-pro
                </option>
              </select>
              <input
                v-else
                v-model="soraForm.model"
                type="text"
                class="form-input"
                placeholder="输入自定义模型名称"
              >
              <button
                type="button"
                class="toggle-btn"
                :title="soraModelCustom ? '切换为下拉选择' : '切换为自定义输入'"
                @click="soraModelCustom = !soraModelCustom"
              >
                {{ soraModelCustom ? '📋' : '✏️' }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">提示词</label>
            <textarea
              v-model="soraForm.prompt"
              class="form-textarea"
              placeholder="描述你想要生成的视频内容..."
            />
          </div>

          <div class="form-group">
            <label class="form-label">尺寸</label>
            <select v-model="soraForm.size" class="form-select">
              <option value="1280x720">
                横屏 (1280x720)
              </option>
              <option value="720x1280">
                竖屏 (720x1280)
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">时长 (秒)</label>
            <div class="input-with-toggle">
              <select
                v-if="!soraDurationCustom"
                v-model.number="soraForm.seconds"
                class="form-select"
              >
                <option :value="10">
                  10 秒
                </option>
                <option :value="15">
                  15 秒
                </option>
              </select>
              <input
                v-else
                v-model.number="soraForm.seconds"
                type="number"
                class="form-input"
                min="1"
                max="60"
                placeholder="输入秒数"
              >
              <button
                type="button"
                class="toggle-btn"
                :title="soraDurationCustom ? '切换为下拉选择' : '切换为自定义输入'"
                @click="soraDurationCustom = !soraDurationCustom"
              >
                {{ soraDurationCustom ? '📋' : '✏️' }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">参考图 (可选)</label>
            <div class="file-upload-area">
              <input
                ref="soraFileInput"
                type="file"
                accept="image/*"
                multiple
                style="display: none"
                @change="(e: Event) => {
                  const target = e.target as HTMLInputElement
                  if (target.files) {
                    soraReferenceFiles = [...soraReferenceFiles, ...Array.from(target.files)]
                    target.value = ''
                  }
                }"
              >
              <button type="button" class="btn btn-outline" @click="soraFileInput?.click()">
                📁 选择图片
              </button>
              <span v-if="soraReferenceFiles.length > 0" class="file-count">
                已选 {{ soraReferenceFiles.length }} 张
                <button type="button" class="btn-clear" @click="soraReferenceFiles = []">清除</button>
              </span>
            </div>
          </div>
        </template>

        <!-- VEO 表单 -->
        <template v-else-if="platform === 'veo'">
          <div class="form-group">
            <label class="form-label">模型</label>
            <div class="input-with-toggle">
              <select
                v-if="!veoModelCustom"
                v-model="veoForm.model"
                class="form-select"
              >
                <optgroup label="✨ 高质量版本">
                  <option value="veo_3_1">veo_3_1</option>
                  <option value="veo_3_1-4K">veo_3_1-4K</option>
                </optgroup>
                <optgroup label="⚡ 快速版本">
                  <option value="veo_3_1-fast">veo_3_1-fast</option>
                  <option value="veo_3_1-fast-4K">veo_3_1-fast-4K</option>
                </optgroup>
                <optgroup label="🎨 仅参考图版本">
                  <option value="veo_3_1-components">veo_3_1-components</option>
                  <option value="veo_3_1-components-4K">veo_3_1-components-4K</option>
                  <option value="veo_3_1-fast-components">veo_3_1-fast-components</option>
                  <option value="veo_3_1-fast-components-4K">veo_3_1-fast-components-4K</option>
                </optgroup>
              </select>
              <input
                v-else
                v-model="veoForm.model"
                type="text"
                class="form-input"
                placeholder="输入自定义模型名称"
              >
              <button
                type="button"
                class="toggle-btn"
                :title="veoModelCustom ? '切换为下拉选择' : '切换为自定义输入'"
                @click="veoModelCustom = !veoModelCustom"
              >
                {{ veoModelCustom ? '📋' : '✏️' }}
              </button>
            </div>
            <small class="form-hint">4K 版本请在模型名后加 -4K；使用 -components 后缀强制参考图模式</small>
          </div>

          <div class="form-group">
            <label class="form-label">提示词</label>
            <textarea
              v-model="veoForm.prompt"
              class="form-textarea"
              placeholder="描述你想要生成的视频内容..."
            />
          </div>

          <div class="form-group">
            <label class="form-label">尺寸</label>
            <select v-model="veoForm.size" class="form-select">
              <option value="1280x720">
                横屏 (1280x720)
              </option>
              <option value="720x1280">
                竖屏 (720x1280)
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">时长</label>
            <select v-model="veoForm.seconds" class="form-select">
              <option :value="8">
                8 秒
              </option>
            </select>
          </div>

          <!-- 参考图上传 -->
          <div class="form-group">
            <label class="form-label">参考图 (可选)</label>
            <div class="reference-upload">
              <input
                ref="veoFileInput"
                type="file"
                accept="image/*"
                multiple
                style="display: none"
                @change="handleVeoFileSelect"
              >
              <button
                type="button"
                class="btn btn-secondary upload-btn"
                @click="veoFileInput?.click()"
              >
                📷 选择图片
              </button>
              <span class="upload-hint">
                1张=首帧，2张=首尾帧，3张=参考图模式
              </span>
            </div>
            
            <!-- 已选图片预览 -->
            <div v-if="veoReferenceFiles.length > 0" class="reference-preview">
              <div
                v-for="(file, index) in veoReferenceFiles"
                :key="index"
                class="preview-item"
              >
                <img :src="getFilePreviewUrl(file)" :alt="file.name">
                <span class="preview-name">{{ file.name }}</span>
                <button
                  type="button"
                  class="preview-remove"
                  @click="removeVeoFile(index)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Grok 表单 -->
        <template v-else-if="platform === 'grok'">
          <div class="form-group">
            <label class="form-label">模型</label>
            <div class="input-with-toggle">
              <select
                v-if="!grokModelCustom"
                v-model="grokForm.model"
                class="form-select"
              >
                <option value="grok-video-3">
                  grok-video-3 (6秒)
                </option>
                <option value="grok-video-3-max">
                  grok-video-3-max (15秒)
                </option>
                <option value="grok-video-pro">
                  grok-video-pro (10秒)
                </option>
              </select>
              <input
                v-else
                v-model="grokForm.model"
                type="text"
                class="form-input"
                placeholder="输入自定义模型名称"
              >
              <button
                type="button"
                class="toggle-btn"
                :title="grokModelCustom ? '切换为下拉选择' : '切换为自定义输入'"
                @click="grokModelCustom = !grokModelCustom"
              >
                {{ grokModelCustom ? '📋' : '✏️' }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">提示词</label>
            <textarea
              v-model="grokForm.prompt"
              class="form-textarea"
              placeholder="描述你想要生成的视频内容..."
            />
          </div>

          <div class="form-group">
            <label class="form-label">尺寸比例</label>
            <select v-model="grokForm.aspect_ratio" class="form-select">
              <option value="3:2">横屏 (3:2)</option>
              <option value="2:3">竖屏 (2:3)</option>
              <option value="1:1">正方 (1:1)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">分辨率</label>
            <select v-model="grokForm.size" class="form-select">
              <option value="720P">720P</option>
              <option value="1080P">1080P</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">时长</label>
            <select v-model.number="grokForm.seconds" class="form-select">
              <option :value="6">6 秒 (grok-video-3)</option>
              <option :value="15">15 秒 (grok-video-3-max)</option>
              <option :value="10">10 秒 (grok-video-pro)</option>
            </select>
          </div>

          <!-- 参考图上传 -->
          <div class="form-group">
            <label class="form-label">参考图 (可选)</label>
            <div class="reference-upload">
              <input
                ref="grokFileInput"
                type="file"
                accept="image/*"
                style="display: none"
                @change="handleGrokFileSelect"
              >
              <button
                type="button"
                class="btn btn-secondary upload-btn"
                @click="grokFileInput?.click()"
              >
                📷 选择图片
              </button>
            </div>
            
            <!-- 已选图片预览 -->
            <div v-if="grokReferenceFiles.length > 0" class="reference-preview">
              <div
                v-for="(file, index) in grokReferenceFiles"
                :key="index"
                class="preview-item"
              >
                <img :src="getFilePreviewUrl(file)" :alt="file.name">
                <span class="preview-name">{{ file.name }}</span>
                <button
                  type="button"
                  class="preview-remove"
                  @click="removeGrokFile(index)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- 豆包 表单 -->
        <template v-else>
          <div class="form-group">
            <label class="form-label">模型</label>
            <div class="input-with-toggle">
              <select
                v-if="!doubaoModelCustom"
                v-model="doubaoForm.model"
                class="form-select"
              >
                <optgroup label="🎬 标准版">
                  <option value="doubao-seedance-1-5-pro_480p">doubao-seedance-1-5-pro_480p</option>
                  <option value="doubao-seedance-1-5-pro_720p">doubao-seedance-1-5-pro_720p</option>
                  <option value="doubao-seedance-1-5-pro_1080p">doubao-seedance-1-5-pro_1080p</option>
                </optgroup>
              </select>
              <input
                v-else
                v-model="doubaoForm.model"
                type="text"
                class="form-input"
                placeholder="输入自定义模型名称"
              >
              <button
                type="button"
                class="toggle-btn"
                :title="doubaoModelCustom ? '切换为下拉选择' : '切换为自定义输入'"
                @click="doubaoModelCustom = !doubaoModelCustom"
              >
                {{ doubaoModelCustom ? '📋' : '✏️' }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">提示词</label>
            <textarea
              v-model="doubaoForm.prompt"
              class="form-textarea"
              placeholder="描述你想要生成的视频内容..."
            />
          </div>

          <div class="form-group">
            <label class="form-label">画面比例</label>
            <select v-model="doubaoForm.size" class="form-select">
              <option value="16:9">横屏 (16:9)</option>
              <option value="4:3">横屏 (4:3)</option>
              <option value="1:1">正方 (1:1)</option>
              <option value="3:4">竖屏 (3:4)</option>
              <option value="9:16">竖屏 (9:16)</option>
              <option value="21:9">超宽 (21:9)</option>
              <option value="keep_ratio">保持原始比例</option>
              <option value="adaptive">自适应</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">时长 (秒)</label>
            <div class="input-with-toggle">
              <select
                v-if="!doubaoDurationCustom"
                v-model.number="doubaoForm.seconds"
                class="form-select"
              >
                <option :value="4">4 秒</option>
                <option :value="5">5 秒</option>
                <option :value="6">6 秒</option>
                <option :value="8">8 秒</option>
                <option :value="10">10 秒</option>
                <option :value="12">12 秒</option>
              </select>
              <input
                v-else
                v-model.number="doubaoForm.seconds"
                type="number"
                class="form-input"
                min="4"
                max="12"
                placeholder="输入秒数 (4-12)"
              >
              <button
                type="button"
                class="toggle-btn"
                :title="doubaoDurationCustom ? '切换为下拉选择' : '切换为自定义输入'"
                @click="doubaoDurationCustom = !doubaoDurationCustom"
              >
                {{ doubaoDurationCustom ? '📋' : '✏️' }}
              </button>
            </div>
          </div>

          <!-- 首帧图上传 -->
          <div class="form-group">
            <label class="form-label">首帧图 (可选)</label>
            <div class="reference-upload">
              <input
                ref="doubaoFirstFrameInput"
                type="file"
                accept="image/*"
                style="display: none"
                @change="handleDoubaoFirstFrame"
              >
              <button
                type="button"
                class="btn btn-secondary upload-btn"
                @click="doubaoFirstFrameInput?.click()"
              >
                📷 选择首帧图
              </button>
              <span v-if="doubaoFirstFrame" class="file-count">
                {{ doubaoFirstFrame.name }}
                <button type="button" class="btn-clear" @click="doubaoFirstFrame = null">清除</button>
              </span>
            </div>
          </div>

          <!-- 尾帧图上传 -->
          <div class="form-group">
            <label class="form-label">尾帧图 (可选)</label>
            <div class="reference-upload">
              <input
                ref="doubaoLastFrameInput"
                type="file"
                accept="image/*"
                style="display: none"
                @change="handleDoubaoLastFrame"
              >
              <button
                type="button"
                class="btn btn-secondary upload-btn"
                @click="doubaoLastFrameInput?.click()"
              >
                📷 选择尾帧图
              </button>
              <span v-if="doubaoLastFrame" class="file-count">
                {{ doubaoLastFrame.name }}
                <button type="button" class="btn-clear" @click="doubaoLastFrame = null">清除</button>
              </span>
            </div>
          </div>
        </template>

        <button
          class="btn btn-primary"
          style="width: 100%"
          :disabled="isLoading || isApiConfigMissing"
          @click="createVideo"
        >
          <span v-if="isLoading" class="loading" />
          {{ isLoading ? '生成中...' : '🚀 生成视频' }}
        </button>
      </div>

      <!-- 右侧：最近任务 -->
      <div class="card">
        <h2 class="card-title">
          📋 最近任务
        </h2>

        <div v-if="recentTasks.length === 0" class="empty">
          <p>暂无任务</p>
        </div>

        <div v-else class="task-list">
          <div
            v-for="task in recentTasks"
            :key="task.id"
            class="task-item"
          >
            <div class="task-info">
              <div class="task-title">
                {{ task.prompt.slice(0, 50) }}{{ task.prompt.length > 50 ? '...' : '' }}
              </div>
              <div class="task-id" :title="task.id">
                ID: {{ task.id }}
              </div>
              <div class="task-meta">
                <span class="status-badge" :class="`status-${task.status}`">
                  {{ statusText[task.status] }}
                </span>
                <span>{{ task.model }}</span>
              </div>
              <div v-if="task.status === 'processing'" class="progress-bar">
                <div class="progress-bar-fill" :style="{ width: `${task.progress}%` }" />
              </div>
            </div>
            <div class="task-actions">
              <a
                v-if="task.video_url"
                :href="task.video_url"
                target="_blank"
                class="btn btn-secondary"
              >
                查看
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-input);
  border-radius: 8px;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 14px;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-id {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  cursor: pointer;
  user-select: all;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.task-actions {
  margin-left: 12px;
}

/* 带切换按钮的输入框组合 */
.input-with-toggle {
  display: flex;
  gap: 8px;
}

.input-with-toggle .form-select,
.input-with-toggle .form-input {
  flex: 1;
}

.toggle-btn {
  padding: 8px 12px;
  background: var(--bg-input);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.toggle-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: var(--primary);
}

/* 参考图上传样式 */
.reference-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.upload-btn {
  white-space: nowrap;
}

.upload-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.reference-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.preview-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: var(--bg-input);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.preview-item img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}

.preview-name {
  font-size: 10px;
  color: var(--text-muted);
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 4px;
}

.preview-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  border: none;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-remove:hover {
  background: #dc2626;
}

.form-hint {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* API 快捷配置 */
.api-config-section {
  margin-bottom: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.api-config-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: none;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.api-config-toggle:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}

.toggle-arrow {
  font-size: 10px;
}

.api-config-form {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.api-config-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-config-label {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 60px;
}

.api-config-row .form-input {
  flex: 1;
  padding: 6px 10px;
  font-size: 13px;
}

.api-config-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-sm {
  padding: 5px 14px;
  font-size: 12px;
}

.api-config-msg {
  font-size: 12px;
  color: var(--text-muted);
}

.api-config-divider {
  font-size: 12px;
  color: var(--text-muted);
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
  padding-top: 8px;
  margin-top: 2px;
}

.api-config-warning {
  padding: 10px 14px;
  margin-bottom: 12px;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: 8px;
  color: #eab308;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.api-config-warning:hover {
  background: rgba(234, 179, 8, 0.18);
}
</style>

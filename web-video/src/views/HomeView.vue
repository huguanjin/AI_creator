<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { soraApi, veoApi, grokApi, doubaoApi, klingApi, userConfigApi, modelCatalogApi, type AllPlatformModels } from '@/api'
import { type VideoTask, useVideoStore } from '@/stores/video'

const store = useVideoStore()

const platform = ref<'sora' | 'veo' | 'grok' | 'doubao' | 'kling'>('sora')
const isLoading = ref(false)

// 动态模型目录（从数据库加载）
const platformModels = ref<AllPlatformModels>({})
const modelsLoaded = ref(false)

const loadPlatformModels = async () => {
  try {
    const res = await modelCatalogApi.getAllPlatforms()
    platformModels.value = res.data.data
    modelsLoaded.value = true
  } catch (e) {
    console.warn('加载模型目录失败，使用自定义输入', e)
  }
}

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
  channel: 'aifast' as 'aifast' | 'xiaohumini',
})

// Grok 模型自定义输入状态
const grokModelCustom = ref(false)

// Grok 参考图 (aifast 渠道)
const grokReferenceFiles = ref<File[]>([])
const grokFileInput = ref<HTMLInputElement | null>(null)

// Grok 图片URL (xiaohumini 渠道)
const grokImageUrls = ref('')

// 豆包表单
const doubaoForm = ref({
  model: 'doubao-seedance-1-5-pro_720p',
  prompt: '',
  size: '16:9',
  seconds: 5,
  channel: 'aifast' as 'aifast' | 'xiaohumini',
  // xiaohumini 渠道参数
  resolution: '720p',
  camera_fixed: 'false',
  watermark: 'false',
  seed: -1 as number,
  generate_audio: 'true',
})

// 豆包模型自定义输入状态
const doubaoModelCustom = ref(false)
const doubaoDurationCustom = ref(false)

// 豆包首帧/尾帧图片
const doubaoFirstFrame = ref<File | null>(null)
const doubaoLastFrame = ref<File | null>(null)
const doubaoFirstFrameInput = ref<HTMLInputElement | null>(null)
const doubaoLastFrameInput = ref<HTMLInputElement | null>(null)

// 豆包参考图 (xiaohumini 渠道)
const doubaoReferenceFiles = ref<File[]>([])
const doubaoReferenceInput = ref<HTMLInputElement | null>(null)
const doubaoImageUrls = ref('')

// 可灵 (Kling) 表单
const klingForm = ref({
  model: 'Kling-2.1',
  prompt: '',
  seconds: '5',
  size: '16:9',
  scene_type: 'text_to_video' as string,
  image: '',
  images: '' as string,
  motion_level: '' as string,
  resolution: '1080p',
  aspect_ratio: '16:9',
  last_frame_url: '',
  video_url: '',
})

// 可灵模型自定义输入状态
const klingModelCustom = ref(false)

// 可灵文件上传
const klingImageFile = ref<File | null>(null)
const klingImageFileInput = ref<HTMLInputElement | null>(null)
const klingLastFrameFile = ref<File | null>(null)
const klingLastFrameFileInput = ref<HTMLInputElement | null>(null)
const klingReferenceFiles = ref<File[]>([])
const klingReferenceInput = ref<HTMLInputElement | null>(null)

// API 快捷配置
const apiConfigVisible = ref(false)
const apiConfigSaving = ref(false)
const apiConfigMsg = ref('')
const hasTrailingSlash = (url: string) => !!url && url.endsWith('/')
const apiConfig = ref<Record<string, { server: string; key: string; characterServer?: string; characterKey?: string }>>({
  sora: { server: '', key: '', characterServer: '', characterKey: '' },
  veo: { server: '', key: '' },
  grok: { server: '', key: '' },
  doubao: { server: '', key: '' },
  kling: { server: '', key: '' },
})

const loadApiConfig = async () => {
  try {
    const response = await userConfigApi.getFullConfig()
    const data = response.data.data
    for (const svc of ['sora', 'veo', 'grok', 'doubao', 'kling'] as const) {
      if (data[svc]) {
        apiConfig.value[svc] = { server: data[svc].server || '', key: data[svc].key || '' }
      }
    }
    // Sora 角色 API 配置
    if (data.sora) {
      apiConfig.value.sora.characterServer = data.sora.characterServer || ''
      apiConfig.value.sora.characterKey = data.sora.characterKey || ''
    }
    // Grok 渠道偏好
    if (data.grok?.channel) {
      grokForm.value.channel = data.grok.channel as 'aifast' | 'xiaohumini'
    }
    // 豆包渠道偏好
    if (data.doubao?.channel) {
      doubaoForm.value.channel = data.doubao.channel as 'aifast' | 'xiaohumini'
    }
  } catch (e) {
    console.error('加载 API 配置失败', e)
  }
}

// 渠道变更时自动保存到用户配置
watch(() => grokForm.value.channel, async (newChannel) => {
  try {
    await userConfigApi.updateServiceConfig('grok', { channel: newChannel })
  } catch (e) {
    console.error('保存渠道偏好失败', e)
  }
})

// 豆包渠道变更时自动保存到用户配置
watch(() => doubaoForm.value.channel, async (newChannel) => {
  try {
    await userConfigApi.updateServiceConfig('doubao', { channel: newChannel })
  } catch (e) {
    console.error('保存豆包渠道偏好失败', e)
  }
})

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

// 检查当前平台 API 地址是否末尾有 /
const hasApiServerTrailingSlash = computed(() => {
  const cfg = apiConfig.value[platform.value]
  if (!cfg) return false
  if (hasTrailingSlash(cfg.server)) return true
  if (platform.value === 'sora' && hasTrailingSlash(cfg.characterServer || '')) return true
  return false
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
        : platform.value === 'kling'
          ? klingForm.value.prompt
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
        channel: doubaoForm.value.channel,
        // xiaohumini 渠道参数
        ...(doubaoForm.value.channel === 'xiaohumini' ? {
          resolution: doubaoForm.value.resolution,
          camera_fixed: doubaoForm.value.camera_fixed,
          watermark: doubaoForm.value.watermark,
          seed: doubaoForm.value.seed,
          generate_audio: doubaoForm.value.generate_audio,
          images: doubaoImageUrls.value.trim()
            ? doubaoImageUrls.value.split('\n').map(u => u.trim()).filter(Boolean)
            : undefined,
        } : {}),
      },
        doubaoFirstFrame.value || undefined,
        doubaoLastFrame.value || undefined,
        doubaoForm.value.channel === 'xiaohumini' && doubaoReferenceFiles.value.length > 0
          ? doubaoReferenceFiles.value
          : undefined,
      )

      task = {
        id: response.data.id,
        model: doubaoForm.value.model,
        prompt: doubaoForm.value.prompt,
        status: 'queued',
        progress: 0,
        created_at: Date.now(),
        platform: 'doubao',
        channel: doubaoForm.value.channel,
      }
    }
    else if (platform.value === 'kling') {
      // 可灵 - JSON 请求
      const metadata: Record<string, any> = {}
      if (klingForm.value.scene_type) metadata.scene_type = klingForm.value.scene_type
      if (klingForm.value.motion_level) metadata.motion_level = klingForm.value.motion_level
      if (klingForm.value.last_frame_url) metadata.last_frame_url = klingForm.value.last_frame_url
      if (klingForm.value.video_url) metadata.video_url = klingForm.value.video_url
      metadata.output_config = {
        resolution: klingForm.value.resolution,
        aspect_ratio: klingForm.value.aspect_ratio,
      }

      const klingParams: any = {
        model: klingForm.value.model,
        prompt: klingForm.value.prompt,
      }
      if (klingForm.value.seconds) klingParams.seconds = klingForm.value.seconds
      if (klingForm.value.size) klingParams.size = klingForm.value.size
      // 没有上传文件时才传 URL
      if (!klingImageFile.value && klingForm.value.image) klingParams.image = klingForm.value.image
      if (klingReferenceFiles.value.length === 0 && klingForm.value.images) {
        klingParams.images = klingForm.value.images.split('\n').map((u: string) => u.trim()).filter(Boolean)
      }
      if (Object.keys(metadata).length > 0) klingParams.metadata = metadata

      response = await klingApi.createVideo(
        klingParams,
        klingImageFile.value || undefined,
        klingLastFrameFile.value || undefined,
        klingReferenceFiles.value.length > 0 ? klingReferenceFiles.value : undefined,
      )

      task = {
        id: response.data.id,
        model: klingForm.value.model,
        prompt: klingForm.value.prompt,
        status: 'queued',
        progress: 0,
        created_at: Date.now(),
        platform: 'kling',
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
        channel: grokForm.value.channel,
        images: grokForm.value.channel === 'xiaohumini' && grokImageUrls.value.trim()
          ? grokImageUrls.value.split('\n').map(u => u.trim()).filter(Boolean)
          : undefined,
      }, grokReferenceFiles.value.length > 0 ? grokReferenceFiles.value : undefined)

      task = {
        id: response.data.id,
        model: grokForm.value.model,
        prompt: grokForm.value.prompt,
        status: 'queued',
        progress: 0,
        created_at: Date.now(),
        platform: 'grok',
        channel: grokForm.value.channel,
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
      doubaoReferenceFiles.value = []
      doubaoImageUrls.value = ''
    }
    else if (platform.value === 'kling') {
      klingForm.value.prompt = ''
      klingForm.value.image = ''
      klingForm.value.images = ''
      klingForm.value.last_frame_url = ''
      klingForm.value.video_url = ''
      klingImageFile.value = null
      klingLastFrameFile.value = null
      klingReferenceFiles.value = []
    }
    else {
      grokForm.value.prompt = ''
      grokReferenceFiles.value = []
      grokImageUrls.value = ''
    }

    // 开始轮询
    pollTaskStatus(task.id, task.platform, task.channel)
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

// 豆包参考图处理 (xiaohumini 渠道)
const handleDoubaoReferenceSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files) {
    const newFiles = Array.from(input.files)
    doubaoReferenceFiles.value = [...doubaoReferenceFiles.value, ...newFiles]
  }
  input.value = ''
}

const removeDoubaoReferenceFile = (index: number) => {
  doubaoReferenceFiles.value.splice(index, 1)
}

// 可灵参考图处理
const handleKlingImageFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    klingImageFile.value = input.files[0]
  }
  input.value = ''
}

// 可灵尾帧图处理
const handleKlingLastFrameFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    klingLastFrameFile.value = input.files[0]
  }
  input.value = ''
}

// 可灵多图参考处理
const handleKlingReferenceSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files) {
    const newFiles = Array.from(input.files)
    klingReferenceFiles.value = [...klingReferenceFiles.value, ...newFiles]
  }
  input.value = ''
}

const removeKlingReferenceFile = (index: number) => {
  klingReferenceFiles.value.splice(index, 1)
}

// 轮询任务状态
const pollTaskStatus = async (taskId: string, taskPlatform: 'sora' | 'veo' | 'grok' | 'doubao' | 'kling', taskChannel?: string) => {
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
            ? await doubaoApi.queryVideo(taskId, taskChannel)
            : taskPlatform === 'kling'
              ? await klingApi.queryVideo(taskId)
              : await grokApi.queryVideo(taskId, taskChannel)

      const data = response.data

      if (data.status === 'completed') {
        store.updateTask(taskId, {
          status: 'completed',
          progress: 100,
          video_url: data.video_url || data.url,
        })
        return
      }
      else if (data.status === 'failed' || data.status === 'error') {
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
  // 加载模型目录
  await loadPlatformModels()

  // 加载用户 API 配置
  await loadApiConfig()

  // 先从数据库加载任务列表
  await store.loadTasks()

  // 恢复未完成任务的轮询
  store.tasks.forEach((task) => {
    if (task.status === 'queued' || task.status === 'processing')
      pollTaskStatus(task.id, task.platform, task.channel)
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
      <button
        class="tab"
        :class="{ active: platform === 'kling' }"
        @click="platform = 'kling'"
      >
        🎞️ 可灵 (Kling)
      </button>
    </div>

    <div class="grid grid-2">
      <!-- 左侧：输入表单 -->
      <div class="card">
        <h2 class="card-title">
          {{ platform === 'sora' ? '🎨 Sora 视频生成' : platform === 'veo' ? '🎥 VEO 视频生成' : platform === 'grok' ? '⚡ Grok 视频生成' : platform === 'kling' ? '🎞️ 可灵视频生成' : '🫘 豆包视频生成' }}
        </h2>

        <!-- API 快捷配置 -->
        <div v-if="isApiConfigMissing" class="api-config-warning" @click="apiConfigVisible = true">
          ⚠️ 当前平台尚未配置 API 地址或密钥，请先展开下方配置并填写
        </div>
        <div v-if="!apiConfigVisible && hasApiServerTrailingSlash" class="api-config-warning" @click="apiConfigVisible = true">
          ⚠️ API 地址末尾不需要 /，请展开配置并删除
        </div>
        <div class="api-config-section">
          <button type="button" class="api-config-toggle" @click="apiConfigVisible = !apiConfigVisible">
            ⚙️ API 配置
            <span class="toggle-arrow">{{ apiConfigVisible ? '▲' : '▼' }}</span>
          </button>
          <div v-if="apiConfigVisible" class="api-config-form">
            <div class="api-config-row">
              <label class="api-config-label">API 地址</label>
              <div class="api-config-field">
                <input
                  v-model="apiConfig[platform].server"
                  type="text"
                  class="form-input"
                  placeholder="https://api.example.com"
                >
                <span v-if="hasTrailingSlash(apiConfig[platform].server)" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
              </div>
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
                <div class="api-config-field">
                  <input
                    v-model="apiConfig.sora.characterServer"
                    type="text"
                    class="form-input"
                    placeholder="角色 API 地址（留空则使用主地址）"
                  >
                  <span v-if="hasTrailingSlash(apiConfig.sora.characterServer || '')" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
                </div>
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
                <template v-if="platformModels.sora && Object.keys(platformModels.sora).length">
                  <optgroup v-for="(models, category) in platformModels.sora" :key="category" :label="category">
                    <option v-for="m in models" :key="m.value" :value="m.value">{{ m.name }}</option>
                  </optgroup>
                </template>
                <template v-else>
                  <option value="sora-2">sora-2</option>
                  <option value="sora-2-pro">sora-2-pro</option>
                </template>
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
                <template v-if="platformModels.veo && Object.keys(platformModels.veo).length">
                  <optgroup v-for="(models, category) in platformModels.veo" :key="category" :label="category">
                    <option v-for="m in models" :key="m.value" :value="m.value">{{ m.name }}</option>
                  </optgroup>
                </template>
                <template v-else>
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
                </template>
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
            <label class="form-label">接口渠道</label>
            <select v-model="grokForm.channel" class="form-select">
              <option value="aifast">aifast 接口</option>
              <option value="xiaohumini">xiaohumini站 接口</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">模型</label>
            <div class="input-with-toggle">
              <select
                v-if="!grokModelCustom"
                v-model="grokForm.model"
                class="form-select"
              >
                <template v-if="platformModels.grok && Object.keys(platformModels.grok).length">
                  <optgroup v-for="(models, category) in platformModels.grok" :key="category" :label="category">
                    <option v-for="m in models" :key="m.value" :value="m.value">{{ m.name }}</option>
                  </optgroup>
                </template>
                <template v-else>
                  <optgroup label="aifast 接口">
                    <option value="grok-video-3">grok-video-3 (6秒)</option>
                    <option value="grok-video-3-max">grok-video-3-max (15秒)</option>
                    <option value="grok-video-pro">grok-video-pro (10秒)</option>
                  </optgroup>
                  <optgroup label="xiaohumini站 接口">
                    <option value="grok-video-3-10s">grok-video-3-10s (10秒)</option>
                    <option value="grok-video-3-15s">grok-video-3-15s (15秒)</option>
                  </optgroup>
                </template>
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

          <div v-if="grokForm.channel === 'aifast'" class="form-group">
            <label class="form-label">时长</label>
            <select v-model.number="grokForm.seconds" class="form-select">
              <option :value="6">6 秒 (grok-video-3)</option>
              <option :value="15">15 秒 (grok-video-3-max)</option>
              <option :value="10">10 秒 (grok-video-pro)</option>
            </select>
          </div>

          <!-- 参考图上传（两个渠道都支持） -->
          <div class="form-group">
            <label class="form-label">参考图 (可选{{ grokForm.channel === 'xiaohumini' ? '，上传后会自动转为URL' : '' }})</label>
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

          <!-- xiaohumini 渠道额外支持：图片URL输入 -->
          <div v-if="grokForm.channel === 'xiaohumini'" class="form-group">
            <label class="form-label">图片链接 (可选，每行一个URL，也可直接上传图片)</label>
            <textarea
              v-model="grokImageUrls"
              class="form-textarea"
              placeholder="输入图片URL，每行一个&#10;例如: https://example.com/image.png"
              rows="3"
            />
          </div>
        </template>

        <!-- 豆包 表单 -->
        <template v-else-if="platform === 'doubao'">
          <div class="form-group">
            <label class="form-label">接口渠道</label>
            <select v-model="doubaoForm.channel" class="form-select">
              <option value="aifast">aifast 接口</option>
              <option value="xiaohumini">xiaohumini站 接口</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">模型</label>
            <div class="input-with-toggle">
              <select
                v-if="!doubaoModelCustom"
                v-model="doubaoForm.model"
                class="form-select"
              >
                <template v-if="platformModels.doubao && Object.keys(platformModels.doubao).length">
                  <optgroup v-for="(models, category) in platformModels.doubao" :key="category" :label="category">
                    <option v-for="m in models" :key="m.value" :value="m.value">{{ m.name }}</option>
                  </optgroup>
                </template>
                <template v-else>
                  <template v-if="doubaoForm.channel === 'aifast'">
                    <optgroup label="🎬 标准版">
                      <option value="doubao-seedance-1-5-pro_480p">doubao-seedance-1-5-pro_480p</option>
                      <option value="doubao-seedance-1-5-pro_720p">doubao-seedance-1-5-pro_720p</option>
                      <option value="doubao-seedance-1-5-pro_1080p">doubao-seedance-1-5-pro_1080p</option>
                    </optgroup>
                  </template>
                  <template v-else>
                    <optgroup label="🎬 Seedance 1.5 Pro">
                      <option value="doubao-seedance-1-5-pro-251215">doubao-seedance-1-5-pro-251215 (文生/首帧/首尾帧)</option>
                    </optgroup>
                    <optgroup label="⚡ Seedance 1.0 Pro">
                      <option value="doubao-seedance-1-0-pro-250528">doubao-seedance-1-0-pro-250528 (文生/首帧/首尾帧)</option>
                      <option value="doubao-seedance-1-0-pro-fast-251015">doubao-seedance-1-0-pro-fast-251015 (文生/首帧)</option>
                    </optgroup>
                    <optgroup label="🎨 Seedance 1.0 Lite">
                      <option value="doubao-seedance-1-0-lite-t2v-250428">doubao-seedance-1-0-lite-t2v-250428 (文生)</option>
                      <option value="doubao-seedance-1-0-lite-i2v-250428">doubao-seedance-1-0-lite-i2v-250428 (首帧/首尾帧/参考图)</option>
                    </optgroup>
                  </template>
                </template>
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

          <!-- xiaohumini 渠道：分辨率 -->
          <div v-if="doubaoForm.channel === 'xiaohumini'" class="form-group">
            <label class="form-label">分辨率</label>
            <select v-model="doubaoForm.resolution" class="form-select">
              <option value="480p">480p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p（参考图不支持）</option>
            </select>
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
              <template v-if="doubaoForm.channel === 'aifast'">
                <option value="keep_ratio">保持原始比例</option>
              </template>
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
                <template v-if="doubaoForm.channel === 'xiaohumini'">
                  <option :value="2">2 秒</option>
                  <option :value="3">3 秒</option>
                </template>
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
                :min="doubaoForm.channel === 'xiaohumini' ? 2 : 4"
                max="12"
                :placeholder="doubaoForm.channel === 'xiaohumini' ? '输入秒数 (2-12)' : '输入秒数 (4-12)'"
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

          <!-- xiaohumini 渠道：额外参数 -->
          <template v-if="doubaoForm.channel === 'xiaohumini'">
            <div class="form-group">
              <label class="form-label">固定摄像头</label>
              <select v-model="doubaoForm.camera_fixed" class="form-select">
                <option value="false">否</option>
                <option value="true">是（参考图不支持）</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">水印</label>
              <select v-model="doubaoForm.watermark" class="form-select">
                <option value="false">无水印</option>
                <option value="true">有水印</option>
              </select>
            </div>

            <div v-if="doubaoForm.model.includes('1-5-pro')" class="form-group">
              <label class="form-label">生成音频</label>
              <select v-model="doubaoForm.generate_audio" class="form-select">
                <option value="true">是（仅 Seedance 1.5 Pro）</option>
                <option value="false">否</option>
              </select>
            </div>
          </template>

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

          <!-- xiaohumini 渠道：参考图上传 -->
          <template v-if="doubaoForm.channel === 'xiaohumini'">
            <div class="form-group">
              <label class="form-label">参考图 (可选，最多4张，仅 lite-i2v 模型)</label>
              <div class="reference-upload">
                <input
                  ref="doubaoReferenceInput"
                  type="file"
                  accept="image/*"
                  multiple
                  style="display: none"
                  @change="handleDoubaoReferenceSelect"
                >
                <button
                  type="button"
                  class="btn btn-secondary upload-btn"
                  @click="doubaoReferenceInput?.click()"
                >
                  📷 选择参考图
                </button>
                <span v-if="doubaoReferenceFiles.length > 0" class="file-count">
                  已选 {{ doubaoReferenceFiles.length }} 张
                  <button type="button" class="btn-clear" @click="doubaoReferenceFiles = []">清除</button>
                </span>
              </div>

              <!-- 已选参考图预览 -->
              <div v-if="doubaoReferenceFiles.length > 0" class="reference-preview">
                <div
                  v-for="(file, index) in doubaoReferenceFiles"
                  :key="index"
                  class="preview-item"
                >
                  <img :src="getFilePreviewUrl(file)" :alt="file.name">
                  <span class="preview-name">{{ file.name }}</span>
                  <button
                    type="button"
                    class="preview-remove"
                    @click="removeDoubaoReferenceFile(index)"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <!-- 图片链接输入 -->
            <div class="form-group">
              <label class="form-label">图片链接 (可选，每行一个URL，也可直接上传)</label>
              <textarea
                v-model="doubaoImageUrls"
                class="form-textarea"
                placeholder="输入图片URL，每行一个&#10;例如: https://example.com/image.png"
                rows="3"
              />
            </div>
          </template>
        </template>

        <!-- 可灵 (Kling) 表单 -->
        <template v-else>
          <div class="form-group">
            <label class="form-label">模型</label>
            <div class="input-with-toggle">
              <select
                v-if="!klingModelCustom"
                v-model="klingForm.model"
                class="form-select"
              >
                <template v-if="platformModels.kling && Object.keys(platformModels.kling).length">
                  <optgroup v-for="(models, category) in platformModels.kling" :key="category" :label="category">
                    <option v-for="m in models" :key="m.value" :value="m.value">{{ m.name }}</option>
                  </optgroup>
                </template>
                <template v-else>
                  <optgroup label="🎬 标准版">
                    <option value="Kling-1.6">Kling-1.6</option>
                    <option value="Kling-2.0">Kling-2.0</option>
                    <option value="Kling-2.1">Kling-2.1</option>
                    <option value="Kling-2.5">Kling-2.5</option>
                    <option value="Kling-2.6">Kling-2.6</option>
                    <option value="Kling-3.0">Kling-3.0</option>
                  </optgroup>
                  <optgroup label="✨ 高级版">
                    <option value="Kling-3.0-Omni">Kling-3.0-Omni</option>
                    <option value="Kling-O1">Kling-O1</option>
                  </optgroup>
                  <optgroup label="📦 按量计费组合">
                    <option value="kling-3.0-omni-1080p-ref-audio">kling-3.0-omni-1080p-ref-audio</option>
                    <option value="kling-2.6-motion-pro-1080p">kling-2.6-motion-pro-1080p</option>
                    <option value="kling-avatar-720p">kling-avatar-720p</option>
                    <option value="kling-identify-face">kling-identify-face</option>
                  </optgroup>
                </template>
              </select>
              <input
                v-else
                v-model="klingForm.model"
                type="text"
                class="form-input"
                placeholder="输入自定义模型名称"
              >
              <button
                type="button"
                class="toggle-btn"
                :title="klingModelCustom ? '切换为下拉选择' : '切换为自定义输入'"
                @click="klingModelCustom = !klingModelCustom"
              >
                {{ klingModelCustom ? '📋' : '✏️' }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">场景类型</label>
            <select v-model="klingForm.scene_type" class="form-select">
              <option value="text_to_video">文生视频</option>
              <option value="image_to_video">图生视频</option>
              <option value="motion_control">运动控制</option>
              <option value="avatar">数字人</option>
              <option value="lip_sync">口型同步</option>
              <option value="template_effect">模板特效</option>
              <option value="first_last_frame">首尾帧</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">提示词</label>
            <textarea
              v-model="klingForm.prompt"
              class="form-textarea"
              placeholder="描述你想要生成的视频内容..."
            />
          </div>

          <!-- 短参数并排显示 -->
          <div class="form-row-2col">
            <div class="form-group">
              <label class="form-label">时长 (秒)</label>
              <input
                v-model="klingForm.seconds"
                type="number"
                class="form-input"
                min="3"
                max="15"
                step="1"
                placeholder="3-15"
              >
            </div>
            <div class="form-group">
              <label class="form-label">分辨率</label>
              <select v-model="klingForm.resolution" class="form-select">
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </div>
          </div>

          <div class="form-row-2col">
            <div class="form-group">
              <label class="form-label">画面比例</label>
              <select v-model="klingForm.aspect_ratio" class="form-select">
                <option value="16:9">横屏 16:9</option>
                <option value="9:16">竖屏 9:16</option>
                <option value="1:1">正方 1:1</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">运动幅度</label>
              <select v-model="klingForm.motion_level" class="form-select">
                <option value="">默认</option>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
          </div>

          <!-- 参考图：图生视频 / 首尾帧 / 运动控制 / 数字人 时显示 -->
          <template v-if="['image_to_video', 'first_last_frame', 'motion_control', 'avatar'].includes(klingForm.scene_type)">
            <div class="form-group">
              <label class="form-label">参考图 (图生视频)</label>
              <div class="reference-upload">
                <input
                  ref="klingImageFileInput"
                  type="file"
                  accept="image/*"
                  style="display: none"
                  @change="handleKlingImageFile"
                >
                <button
                  type="button"
                  class="btn btn-secondary upload-btn"
                  @click="klingImageFileInput?.click()"
                >
                  📷 上传参考图
                </button>
                <span v-if="klingImageFile" class="file-count">
                  {{ klingImageFile.name }}
                  <button type="button" class="btn-clear" @click="klingImageFile = null">清除</button>
                </span>
              </div>
              <input
                v-if="!klingImageFile"
                v-model="klingForm.image"
                type="text"
                class="form-input"
                style="margin-top: 6px"
                placeholder="或输入图片 URL"
              >
            </div>

            <div class="form-group">
              <label class="form-label">多图参考 (可选)</label>
              <div class="reference-upload">
                <input
                  ref="klingReferenceInput"
                  type="file"
                  accept="image/*"
                  multiple
                  style="display: none"
                  @change="handleKlingReferenceSelect"
                >
                <button
                  type="button"
                  class="btn btn-secondary upload-btn"
                  @click="klingReferenceInput?.click()"
                >
                  📷 上传多张参考图
                </button>
                <span v-if="klingReferenceFiles.length > 0" class="file-count">
                  已选 {{ klingReferenceFiles.length }} 张
                  <button type="button" class="btn-clear" @click="klingReferenceFiles = []">清除</button>
                </span>
              </div>
              <div v-if="klingReferenceFiles.length > 0" class="reference-preview">
                <div
                  v-for="(file, index) in klingReferenceFiles"
                  :key="index"
                  class="preview-item"
                >
                  <img :src="getFilePreviewUrl(file)" :alt="file.name">
                  <span class="preview-name">{{ file.name }}</span>
                  <button
                    type="button"
                    class="preview-remove"
                    @click="removeKlingReferenceFile(index)"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <textarea
                v-if="klingReferenceFiles.length === 0"
                v-model="klingForm.images"
                class="form-textarea"
                style="margin-top: 6px"
                placeholder="或输入图片URL，每行一个"
                rows="2"
              />
            </div>
          </template>

          <!-- 尾帧图：首尾帧模式时显示 -->
          <template v-if="klingForm.scene_type === 'first_last_frame'">
            <div class="form-group">
              <label class="form-label">尾帧图</label>
              <div class="reference-upload">
                <input
                  ref="klingLastFrameFileInput"
                  type="file"
                  accept="image/*"
                  style="display: none"
                  @change="handleKlingLastFrameFile"
                >
                <button
                  type="button"
                  class="btn btn-secondary upload-btn"
                  @click="klingLastFrameFileInput?.click()"
                >
                  📷 上传尾帧图
                </button>
                <span v-if="klingLastFrameFile" class="file-count">
                  {{ klingLastFrameFile.name }}
                  <button type="button" class="btn-clear" @click="klingLastFrameFile = null">清除</button>
                </span>
              </div>
              <input
                v-if="!klingLastFrameFile"
                v-model="klingForm.last_frame_url"
                type="text"
                class="form-input"
                style="margin-top: 6px"
                placeholder="或输入尾帧图 URL"
              >
            </div>
          </template>

          <!-- 参考视频：运动控制 / 口型同步 时显示 -->
          <template v-if="['motion_control', 'lip_sync'].includes(klingForm.scene_type)">
            <div class="form-group">
              <label class="form-label">参考视频 URL</label>
              <input
                v-model="klingForm.video_url"
                type="text"
                class="form-input"
                placeholder="https://example.com/video.mp4"
              >
            </div>
          </template>
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
.field-warning {
  display: block;
  color: #e67e22;
  font-size: 12px;
  margin-top: 4px;
  font-weight: 500;
}

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

/* 两列并排布局 */
.form-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-row-2col .form-group {
  margin-bottom: 0;
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

.api-config-field {
  flex: 1;
  min-width: 0;
}

.api-config-field .form-input {
  width: 100%;
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

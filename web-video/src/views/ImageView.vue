<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { geminiImageApi, userConfigApi, promptTemplateApi, modelCatalogApi, type GeminiImageResult, type PromptTemplateItem, type ModelCatalogGrouped } from '@/api'
import axios from 'axios'

const isLoading = ref(false)
const imageForm = ref({
  model: 'gemini-3-pro-image-preview',
  prompt: '',
  aspectRatio: '1:1' as string,
  imageSize: '1K' as string,
  // Grok/GPT 模型参数
  size: '1024x1024' as string,
  n: 1,
})

// 提示词模板相关
const promptTemplates = ref<PromptTemplateItem[]>([])
const selectedTemplate = ref('')
const showTemplateDropdown = ref(false)

// 提示词润色相关
const polishModels = ref<ModelCatalogGrouped>({})
const polishModelValue = ref('gemini-2.5-flash')
const polishModelCustom = ref(false)
const isPolishing = ref(false)
const polishedPrompt = ref('')
const showPolishResult = ref(false)
const polishSystemPrompt = ref('')  // 用户自定义/选择的系统提示词
const defaultSystemPrompt = ref('') // 管理员配置的默认系统提示词
const showSystemPromptInput = ref(false) // 是否显示系统提示词输入框

// 状态和错误信息
const taskStatus = ref('')
const errorMessage = ref('')

// API 配置
const apiConfig = ref({
  geminiImage: { server: '', key: '' },
  grokImage: { server: '', key: '' },
  promptPolish: { server: '', key: '' },
})
const apiConfigSaving = ref({
  geminiImage: false,
  grokImage: false,
  promptPolish: false,
})
const apiConfigMsg = ref({
  geminiImage: '',
  grokImage: '',
  promptPolish: '',
})

// 生成结果
const generatedImages = ref<any[]>([])
const imageHistory = ref<any[]>([])

// 文件上传
const fileInput = ref<HTMLInputElement | null>(null)
const referenceFiles = ref<File[]>([])

// 下载菜单
const showDownloadMenu = ref<number | null>(null)

// 模型自定义切换
const modelCustom = ref(false)

// 加载提示词模板
const loadPromptTemplates = async () => {
  try {
    const res = await promptTemplateApi.getEnabled()
    promptTemplates.value = res.data.data
  } catch (e) {
    console.error('加载提示词模板失败', e)
  }
}

// 加载润色模型列表
const loadPolishModels = async () => {
  try {
    const res = await modelCatalogApi.getByPlatform('promptPolish')
    polishModels.value = res.data.data
  } catch (e) {
    console.error('加载润色模型失败', e)
  }
}

// 加载默认系统提示词
const loadDefaultSystemPrompt = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    const res = await axios.get('/v1/prompt-polish/system-prompt', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.data.status === 'success') {
      defaultSystemPrompt.value = res.data.data.systemPrompt
      polishSystemPrompt.value = res.data.data.systemPrompt
    }
  } catch (e) {
    console.error('加载默认系统提示词失败', e)
  }
}

// 选择角色设定模板（用于润色功能的系统提示词）
const selectTemplate = (template: PromptTemplateItem) => {
  polishSystemPrompt.value = template.content
  selectedTemplate.value = template._id
  showTemplateDropdown.value = false
  showSystemPromptInput.value = true // 自动展开角色设定区域
}

// 润色提示词
const polishPrompt = async () => {
  if (!imageForm.value.prompt.trim()) {
    alert('请先输入提示词')
    return
  }
  isPolishing.value = true
  polishedPrompt.value = ''
  showPolishResult.value = true
  
  try {
    const token = localStorage.getItem('auth_token')
    const apiBase = import.meta.env.VITE_API_BASE || ''
    const response = await fetch(`${apiBase}/v1/prompt-polish/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: imageForm.value.prompt,
        model: polishModelValue.value,
        systemPrompt: polishSystemPrompt.value || undefined,
      }),
    })

    if (!response.ok) {
      throw new Error('润色请求失败')
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim()
            if (jsonStr) {
              try {
                const data = JSON.parse(jsonStr)
                if (data.text) {
                  polishedPrompt.value += data.text
                } else if (data.error) {
                  polishedPrompt.value = `错误: ${data.error}`
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }
    }
  } catch (e: any) {
    polishedPrompt.value = `润色失败: ${e.message}`
  } finally {
    isPolishing.value = false
  }
}

// 使用润色后的提示词
const usePolishedPrompt = () => {
  imageForm.value.prompt = polishedPrompt.value
  showPolishResult.value = false
  polishedPrompt.value = ''
}

// 判断当前模型是否为 Grok/GPT 图片模型
const isGrokModel = computed(() => {
  const m = imageForm.value.model
  return (m.startsWith('grok-') && m.includes('image')) || m.startsWith('gpt-image')
})

// 判断当前模型是否为 Gemini 3.1 Flash Image
const isGemini31Flash = computed(() => {
  return imageForm.value.model === 'gemini-3.1-flash-image-preview'
})

// 根据模型动态计算可选宽高比
const availableAspectRatios = computed(() => {
  const base = [
    { value: '1:1', label: '1:1 (正方形)' },
    { value: '16:9', label: '16:9 (横屏)' },
    { value: '9:16', label: '9:16 (竖屏)' },
    { value: '4:3', label: '4:3' },
    { value: '3:4', label: '3:4' },
  ]
  if (isGemini31Flash.value) {
    base.push(
      { value: '1:4', label: '1:4 (超窄竖屏)' },
      { value: '4:1', label: '4:1 (超宽横屏)' },
      { value: '1:8', label: '1:8 (极窄竖屏)' },
      { value: '8:1', label: '8:1 (极宽横屏)' },
    )
  }
  return base
})

// 根据模型动态计算可选图片尺寸
const availableImageSizes = computed(() => {
  const base = [
    { value: '1K', label: '1K (标准)' },
    { value: '2K', label: '2K (高清)' },
    { value: '4K', label: '4K (超清)' },
  ]
  if (isGemini31Flash.value) {
    base.unshift({ value: '0.5K', label: '0.5K (512px)' })
  }
  return base
})

// 最大参考图片数量
const maxReferenceImages = computed(() => {
  return isGemini31Flash.value ? 14 : 5
})

// API 快捷配置
const apiConfigVisible = ref(false)

// 检查是否已配置当前模型所需的 API
const isApiConfigMissing = computed(() => {
  if (isGrokModel.value) {
    return !apiConfig.value.grokImage.server || !apiConfig.value.grokImage.key
  }
  return !apiConfig.value.geminiImage.server || !apiConfig.value.geminiImage.key
})

// 检查 API 地址是否以 / 结尾
const hasTrailingSlash = (url: string) => {
  return url && url.endsWith('/')
}

const hasApiServerTrailingSlash = computed(() => {
  return hasTrailingSlash(apiConfig.value.geminiImage.server) || 
         hasTrailingSlash(apiConfig.value.grokImage.server) ||
         hasTrailingSlash(apiConfig.value.promptPolish.server)
})

// 加载 API 配置
const loadApiConfig = async () => {
  try {
    const res = await userConfigApi.getFullConfig()
    if (res.data.data) {
      const config = res.data.data
      if (config.geminiImage) apiConfig.value.geminiImage = { ...config.geminiImage }
      if (config.grokImage) apiConfig.value.grokImage = { ...config.grokImage }
      if (config.promptPolish) apiConfig.value.promptPolish = { ...config.promptPolish }
    }
  } catch (e) {
    console.error('加载 API 配置失败', e)
  }
}

// 保存 API 配置
const saveApiConfig = async (type: 'geminiImage' | 'grokImage' | 'promptPolish') => {
  apiConfigSaving.value[type] = true
  apiConfigMsg.value[type] = ''
  try {
    await userConfigApi.updateServiceConfig(type, apiConfig.value[type])
    apiConfigMsg.value[type] = '✅ 保存成功'
    setTimeout(() => {
      apiConfigMsg.value[type] = ''
    }, 2000)
  } catch (e) {
    console.error('保存配置失败', e)
    apiConfigMsg.value[type] = '❌ 保存失败'
  } finally {
    apiConfigSaving.value[type] = false
  }
}

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files) {
    const files = Array.from(input.files)
    if (referenceFiles.value.length + files.length > maxReferenceImages.value) {
      alert(`最多只能上传 ${maxReferenceImages.value} 张参考图片`)
      return
    }
    referenceFiles.value.push(...files)
  }
  // 清空 input，允许重复选择同一文件
  if (input) input.value = ''
}

// 移除文件
const removeFile = (index: number) => {
  referenceFiles.value.splice(index, 1)
}

// 获取文件预览 URL
const getFilePreviewUrl = (file: File) => {
  return URL.createObjectURL(file)
}

// 生成图片
const generateImage = async () => {
  if (!imageForm.value.prompt.trim()) return
  
  isLoading.value = true
  taskStatus.value = '正在提交任务...'
  errorMessage.value = ''
  generatedImages.value = []
  
  try {
    // 转换文件为 Base64
    const referenceImages = []
    for (const file of referenceFiles.value) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      })
      // 去掉 data:image/xxx;base64, 前缀
      referenceImages.push({
        mimeType: file.type,
        data: base64.split(',')[1]
      })
    }

    const payload = {
      ...imageForm.value,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      referenceImage: referenceImages.length > 0 ? referenceImages[0] : undefined // 兼容旧 API
    }

    const res = await geminiImageApi.generateImage(payload)
    
    if (res.data.status === 'success') {
      taskStatus.value = '生成成功！'
      generatedImages.value = res.data.data.images
      
      // 添加到历史记录
      const newHistoryItem = {
        id: Date.now().toString(),
        prompt: imageForm.value.prompt,
        model: imageForm.value.model,
        aspectRatio: imageForm.value.aspectRatio,
        imageSize: imageForm.value.imageSize,
        createdAt: Date.now(),
        images: res.data.data.images
      }
      imageHistory.value.unshift(newHistoryItem)
      saveHistory()
    } else {
      throw new Error(res.data.message || '生成失败')
    }
  } catch (e: any) {
    console.error('生成图片失败', e)
    taskStatus.value = '生成失败'
    errorMessage.value = e.response?.data?.message || e.message || '未知错误'
  } finally {
    isLoading.value = false
  }
}

// 复制提示词
const copyPrompt = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    alert('提示词已复制到剪贴板')
  }).catch(() => {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    alert('提示词已复制到剪贴板')
  })
}

// 从历史记录加载
const loadFromHistory = (item: any) => {
  imageForm.value.prompt = item.prompt
  imageForm.value.model = item.model
  imageForm.value.aspectRatio = item.aspectRatio || '1:1'
  imageForm.value.imageSize = item.imageSize || '1K'
  if (item.images && item.images.length > 0) {
    generatedImages.value = item.images
  }
  // 滚动到顶部
  // window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 清空历史记录
const clearAllHistory = () => {
  if (confirm('确定要清空所有历史记录吗？')) {
    imageHistory.value = []
    saveHistory()
  }
}

// 删除单条历史记录
const deleteHistory = (id: string) => {
  imageHistory.value = imageHistory.value.filter(item => item.id !== id)
  saveHistory()
}

// 下载历史记录中的图片
const downloadHistoryImage = (item: any) => {
  if (item.images && item.images.length > 0) {
    item.images.forEach((image: any, index: number) => {
      downloadImage(image, index, 'original')
    })
  }
}

// 保存历史记录到本地存储
const saveHistory = () => {
  localStorage.setItem('image_history', JSON.stringify(imageHistory.value))
}

// 加载历史记录（从后端）
const loadHistory = async () => {
  try {
    const res = await geminiImageApi.getHistory({ limit: 50, status: 'completed' })
    if (res.data.status === 'success') {
      imageHistory.value = res.data.data.map(task => ({
        id: task.taskId,
        prompt: task.prompt,
        model: task.model,
        aspectRatio: task.aspectRatio,
        imageSize: task.imageSize,
        images: task.images || [],
        createdAt: task.createdAt,
      }))
    }
  } catch (e) {
    console.error('加载历史记录失败', e)
    // 回退到 localStorage
    const history = localStorage.getItem('image_history')
    if (history) {
      try {
        imageHistory.value = JSON.parse(history)
      } catch (err) {
        console.error('解析本地历史记录失败', err)
      }
    }
  }
}

// 下载菜单控制
const toggleDownloadMenu = (index: number) => {
  if (showDownloadMenu.value === index) {
    showDownloadMenu.value = null
  } else {
    showDownloadMenu.value = index
  }
}

const closeDownloadMenu = () => {
  showDownloadMenu.value = null
}

// 下载图片
const downloadImage = async (image: any, index: number, format: 'original' | 'jpg' | 'png') => {
  try {
    const src = getImageSrc(image)
    let blob: Blob
    
    if (src.startsWith('data:')) {
      // Base64
      const res = await fetch(src)
      blob = await res.blob()
    } else {
      // URL
      const res = await fetch(src)
      blob = await res.blob()
    }

    // 如果需要转换格式
    if (format !== 'original' && !image.mimeType.includes(format)) {
      // 使用 Canvas 转换格式
      const img = new Image()
      img.src = URL.createObjectURL(blob)
      await new Promise((resolve) => (img.onload = resolve))
      
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0)
      
      const newMimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
      const newDataUrl = canvas.toDataURL(newMimeType, 0.9)
      const newRes = await fetch(newDataUrl)
      blob = await newRes.blob()
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const ext = format === 'original' ? image.mimeType.split('/')[1] : format
    a.download = `ai-image-${timestamp}-${index + 1}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('下载图片失败', e)
    alert('下载图片失败')
  }
}

onMounted(async () => {
  await loadHistory()
  await loadApiConfig()
  await loadPromptTemplates()
  await loadPolishModels()
  await loadDefaultSystemPrompt()
})

// 格式化时间
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

// 获取图片 src
const getImageSrc = (image: { mimeType: string; url?: string; data?: string }) => {
  if (image.url) {
    const base = import.meta.env.VITE_API_BASE || ''
    return `${base}${image.url}`
  }
  return `data:${image.mimeType};base64,${image.data}`
}
</script>

<template>
  <div class="image-generator">
    <div class="page-header">
      <h1>🎨 AI 图片创作</h1>
      <p class="subtitle">释放你的创意，一键生成精美图像</p>
    </div>

    <div class="main-content">
      <!-- 左侧：表单配置区 -->
      <div class="config-sidebar">
        <!-- API 配置入口 -->
        <div class="api-config-trigger">
           <button class="config-toggle-btn" @click="apiConfigVisible = !apiConfigVisible" :class="{ 'is-active': apiConfigVisible }">
             <span class="icon">⚙️</span> API 设置
             <span v-if="isApiConfigMissing" class="status-dot warning"></span>
           </button>
           
           <!-- API 配置面板 (浮层) -->
           <div v-if="apiConfigVisible" class="api-config-dropdown">
             <div class="config-header">
               <h3>API 密钥配置</h3>
               <button class="close-btn" @click="apiConfigVisible = false">×</button>
             </div>
             
             <!-- Gemini 图片配置 -->
             <div class="config-section">
                <div class="section-title">💎 Gemini 图片</div>
                <input v-model="apiConfig.geminiImage.server" type="text" placeholder="API 地址 (https://...)" class="input-sm">
                <span v-if="hasTrailingSlash(apiConfig.geminiImage.server)" class="warning-text">末尾不需要 /</span>
                <input v-model="apiConfig.geminiImage.key" type="password" placeholder="API Key" class="input-sm">
                <button class="save-btn-sm" :disabled="apiConfigSaving.geminiImage" @click="saveApiConfig('geminiImage')">
                  {{ apiConfigSaving.geminiImage ? '保存中...' : '保存' }}
                </button>
                <span class="msg-text">{{ apiConfigMsg.geminiImage }}</span>
             </div>

             <!-- Grok 图片配置 -->
             <div class="config-section">
                <div class="section-title">⚡ Grok 图片</div>
                <input v-model="apiConfig.grokImage.server" type="text" placeholder="API 地址" class="input-sm">
                <span v-if="hasTrailingSlash(apiConfig.grokImage.server)" class="warning-text">末尾不需要 /</span>
                <input v-model="apiConfig.grokImage.key" type="password" placeholder="API Key" class="input-sm">
                <button class="save-btn-sm" :disabled="apiConfigSaving.grokImage" @click="saveApiConfig('grokImage')">
                  {{ apiConfigSaving.grokImage ? '保存中...' : '保存' }}
                </button>
                <span class="msg-text">{{ apiConfigMsg.grokImage }}</span>
             </div>

             <!-- 润色服务配置 -->
             <div class="config-section">
                <div class="section-title">✨ 润色服务</div>
                <input v-model="apiConfig.promptPolish.server" type="text" placeholder="API 地址" class="input-sm">
                <span v-if="hasTrailingSlash(apiConfig.promptPolish.server)" class="warning-text">末尾不需要 /</span>
                <input v-model="apiConfig.promptPolish.key" type="password" placeholder="API Key" class="input-sm">
                <button class="save-btn-sm" :disabled="apiConfigSaving.promptPolish" @click="saveApiConfig('promptPolish')">
                  {{ apiConfigSaving.promptPolish ? '保存中...' : '保存' }}
                </button>
                <span class="msg-text">{{ apiConfigMsg.promptPolish }}</span>
             </div>
           </div>
        </div>

        <div class="sidebar-scroll">
          <!-- 图片生成模型选择 -->
          <div class="control-group">
            <label class="group-label">🖼️ 生图模型</label>
            <div class="model-selector-wrapper">
              <select v-if="!modelCustom" v-model="imageForm.model" class="modern-select">
                <optgroup label="Gemini">
                  <option value="gemini-3-pro-image-preview">gemini-3-pro-image-preview</option>
                  <option value="gemini-3.1-flash-image-preview">gemini-3.1-flash-image-preview</option>
                  <option value="gemini-2.0-flash-exp-image-generation">gemini-2.0-flash-exp</option>
                </optgroup>
                <optgroup label="Grok">
                  <option value="grok-4-1-image">grok-4-1-image</option>
                  <option value="grok-4-2-image">grok-4-2-image</option>
                </optgroup>
                <optgroup label="GPT">
                  <option value="gpt-image-1.5">gpt-image-1.5</option>
                </optgroup>
              </select>
              <input v-else v-model="imageForm.model" type="text" class="modern-input" placeholder="输入自定义模型名称" />
              <button class="toggle-btn" @click="modelCustom = !modelCustom">
                {{ modelCustom ? '选择' : '自定义' }}
              </button>
            </div>
          </div>

          <!-- 提示词区域 -->
          <div class="control-group prompt-group">
            <div class="group-header">
              <label class="group-label">生图提示词</label>
            </div>
            
            <!-- 主输入框 -->
            <textarea 
              v-model="imageForm.prompt" 
              class="modern-textarea main-prompt" 
              placeholder="描述你想要生成的画面，例如：一只在雨中打伞的柴犬，赛博朋克风格..."
            ></textarea>

            <!-- 润色工具栏 -->
            <div class="polish-toolbar">
              <div class="polish-toolbar-header">
                <span class="toolbar-label">✨ 提示词润色</span>
                <button class="action-link" @click="showSystemPromptInput = !showSystemPromptInput">
                  {{ showSystemPromptInput ? '收起设定 ▲' : '🎭 角色设定 ▼' }}
                </button>
              </div>
              <div class="polish-controls">
                <div class="polish-model-wrapper">
                  <select v-if="!polishModelCustom" v-model="polishModelValue" class="polish-model-select">
                    <template v-for="(models, category) in polishModels" :key="category">
                      <optgroup :label="category">
                        <option v-for="m in models" :key="m.value" :value="m.value">{{ m.name }}</option>
                      </optgroup>
                    </template>
                  </select>
                  <input v-else v-model="polishModelValue" type="text" class="polish-model-input" placeholder="输入润色模型名称" />
                  <button class="toggle-custom-btn" @click="polishModelCustom = !polishModelCustom">
                    {{ polishModelCustom ? '选择' : '自定义' }}
                  </button>
                </div>
                <button class="polish-btn" @click="polishPrompt" :disabled="isPolishing || !imageForm.prompt.trim()">
                  {{ isPolishing ? '润色中...' : '开始润色' }}
                </button>
              </div>
            </div>
            
            <!-- 角色设定输入 -->
            <div v-if="showSystemPromptInput" class="system-prompt-panel">
               <div class="panel-header">
                 <span>角色设定 (告诉AI如何优化提示词)</span>
                 <div class="panel-actions">
                   <button class="action-link" @click="showTemplateDropdown = !showTemplateDropdown">📚 模板</button>
                   <button class="text-btn" @click="polishSystemPrompt = defaultSystemPrompt">重置</button>
                 </div>
               </div>
               <!-- 角色设定模板下拉 -->
               <div v-if="showTemplateDropdown" class="dropdown-panel">
                 <div v-if="promptTemplates.length === 0" class="empty-state">暂无模板（管理员可在后台添加）</div>
                 <div v-else class="template-list">
                   <div v-for="template in promptTemplates" :key="template._id" class="template-item" @click="selectTemplate(template)">
                     <span class="name">{{ template.name }}</span>
                     <span class="category">{{ template.category }}</span>
                   </div>
                 </div>
               </div>
               <textarea v-model="polishSystemPrompt" class="modern-textarea sm" placeholder="例如：你是一个专业的摄影师，请帮我把描述转化为高质量的摄影提示词..."></textarea>
            </div>

            <!-- 润色结果 -->
            <div v-if="showPolishResult" class="polish-result-panel">
               <div class="panel-header polish-header">
                 <span>✨ 润色结果</span>
                 <button class="close-icon" @click="showPolishResult = false">×</button>
               </div>
               <div class="polish-content">{{ polishedPrompt || 'AI正在思考...' }}</div>
               <div class="panel-footer" v-if="polishedPrompt && !isPolishing">
                 <button class="btn-xs primary" @click="usePolishedPrompt">使用</button>
                 <button class="btn-xs secondary" @click="copyPrompt(polishedPrompt)">复制</button>
               </div>
            </div>
          </div>

          <!-- 参数设置 -->
          <div class="params-grid">
            <div class="control-group" v-if="!isGrokModel">
               <label class="group-label">宽高比</label>
               <div class="radio-group-wrapper">
                 <select v-model="imageForm.aspectRatio" class="modern-select">
                    <option v-for="ar in availableAspectRatios" :key="ar.value" :value="ar.value">{{ ar.label }}</option>
                 </select>
               </div>
            </div>
            <div class="control-group">
               <label class="group-label">尺寸/质量</label>
               <select v-if="!isGrokModel" v-model="imageForm.imageSize" class="modern-select">
                  <option v-for="sz in availableImageSizes" :key="sz.value" :value="sz.value">{{ sz.label }}</option>
               </select>
               <select v-else v-model="imageForm.size" class="modern-select">
                  <option value="1024x1024">1024×1024</option>
                  <option value="1536x1024">1536×1024</option>
                  <option value="1024x1536">1024×1536</option>
               </select>
            </div>
          </div>
          
          <div class="control-group" v-if="isGrokModel">
             <label class="group-label">生成数量</label>
             <div class="segmented-control">
                <button v-for="n in 4" :key="n" :class="{ active: imageForm.n === n }" @click="imageForm.n = n">{{ n }}</button>
             </div>
          </div>

          <!-- 参考图 -->
          <div class="control-group">
             <label class="group-label">参考图 <span class="sub-label">(可选)</span></label>
             <div class="upload-area" @click="fileInput?.click()" :class="{ 'has-files': referenceFiles.length > 0 }">
                <input ref="fileInput" type="file" accept="image/*" multiple @change="handleFileSelect" style="display: none" />
                <div v-if="referenceFiles.length === 0" class="upload-placeholder">
                   <span class="icon">📷</span>
                   <span class="text">点击上传参考图</span>
                </div>
                <div v-else class="file-list">
                   <div v-for="(file, index) in referenceFiles" :key="index" class="file-thumb">
                      <img :src="getFilePreviewUrl(file)" />
                      <button class="remove-btn" @click.stop="removeFile(index)">×</button>
                   </div>
                   <div class="add-more-btn" v-if="referenceFiles.length < maxReferenceImages">
                      +
                   </div>
                </div>
             </div>
          </div>

          <!-- 生成按钮 -->
          <div class="submit-area">
             <button class="generate-btn-lg" :disabled="isLoading || !imageForm.prompt.trim() || isApiConfigMissing" @click="generateImage">
                <span v-if="isLoading" class="loader"></span>
                <span v-else>🚀 立即生成</span>
             </button>
             <div v-if="taskStatus" class="status-message" :class="{ error: taskStatus.includes('失败') }">
                {{ taskStatus }} {{ errorMessage ? `: ${errorMessage}` : '' }}
             </div>
          </div>
        </div>
      </div>

      <!-- 右侧：展示区 -->
      <div class="result-viewport">
        <!-- 当前生成结果 -->
        <div class="result-container" :class="{ 'has-result': generatedImages.length > 0 }">
           <div v-if="generatedImages.length === 0" class="empty-state-lg">
              <div class="illustration">🎨</div>
              <h3>开始你的创作之旅</h3>
              <p>在左侧输入提示词，让 AI 为你绘制心目中的画面</p>
           </div>
           
           <div v-else class="image-showcase">
              <div v-for="(image, index) in generatedImages" :key="index" class="showcase-item">
                 <div class="image-wrapper">
                    <img :src="getImageSrc(image)" :alt="`生成结果 ${index+1}`" />
                    <div class="image-overlay">
                       <div class="overlay-actions">
                          <button class="action-btn" @click="downloadImage(image, index, 'original')">📥 下载原图</button>
                          <button class="action-btn" @click="downloadImage(image, index, 'jpg')">📥 下载JPG</button>
                       </div>
                    </div>
                 </div>
                 <div class="showcase-actions">
                    <button class="showcase-btn primary" @click="downloadImage(image, index, 'original')">
                       📥 下载原图
                    </button>
                    <button class="showcase-btn secondary" @click="downloadImage(image, index, 'jpg')">
                       📥 下载JPG
                    </button>
                 </div>
              </div>
           </div>
        </div>

        <!-- 历史记录区域（底部） -->
        <div class="history-section" v-if="imageHistory.length > 0">
           <div class="history-header">
              <h3>📋 历史记录</h3>
              <button class="clear-all-btn" @click="clearAllHistory">🗑️ 清空全部</button>
           </div>
           <div class="history-list">
              <div v-for="item in imageHistory" :key="item.id" class="history-item">
                 <div class="history-thumb" @click="loadFromHistory(item)">
                    <img v-if="item.images && item.images[0]" :src="getImageSrc(item.images[0])" />
                    <div v-else class="thumb-placeholder">🖼️</div>
                 </div>
                 <div class="history-info">
                    <div class="history-prompt" :title="item.prompt">{{ item.prompt }}</div>
                    <div class="history-meta">
                       {{ item.aspectRatio || '1:1' }} | {{ item.imageSize || '1K' }} | {{ formatTime(item.createdAt) }}
                    </div>
                 </div>
                 <div class="history-actions">
                    <button class="history-btn copy" @click="copyPrompt(item.prompt)">📋 复制</button>
                    <button class="history-btn view" @click="loadFromHistory(item)">👁️ 查看</button>
                    <button class="history-btn delete" @click="deleteHistory(item.id)">🗑️ 删除</button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全局重置与变量 */
.image-generator {
  --primary-color: #6366f1;
  --primary-hover: #4f46e5;
  --bg-color: #f8fafc;
  --card-bg: #ffffff;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --border-color: #e2e8f0;
  --radius-lg: 16px;
  --radius-md: 8px;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  
  max-width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  color: var(--text-primary);
  overflow: hidden;
}

/* 顶部标题栏 */
.page-header {
  padding: 16px 24px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(to right, #6366f1, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.page-header .subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

/* 主布局 */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧边栏 */
.config-sidebar {
  width: 360px;
  background: var(--card-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
}

.sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* API 配置 */
.api-config-trigger {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  position: relative;
}

.config-toggle-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f1f5f9;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.config-toggle-btn:hover, .config-toggle-btn.is-active {
  background: #e2e8f0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: auto;
}

.status-dot.warning {
  background-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
}

.api-config-dropdown {
  position: absolute;
  top: 100%;
  left: 10px;
  right: 10px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 16px;
  z-index: 100;
  margin-top: 8px;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.config-header h3 {
  font-size: 14px;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-secondary);
}

.config-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px dashed var(--border-color);
}

.config-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.input-sm {
  width: 100%;
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 6px;
}

.save-btn-sm {
  padding: 4px 10px;
  font-size: 11px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn-sm:disabled {
  opacity: 0.6;
}

.msg-text {
  font-size: 11px;
  margin-left: 8px;
  color: #10b981;
}

.warning-text {
  font-size: 11px;
  color: #f59e0b;
  display: block;
  margin-bottom: 4px;
}

/* 通用控件样式 */
.control-group {
  margin-bottom: 24px;
}

.group-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.sub-label {
  font-weight: 400;
  color: var(--text-secondary);
  font-size: 12px;
}

.model-selector-wrapper {
  display: flex;
  gap: 8px;
}

.modern-select, .modern-input, .modern-textarea {
  width: 100%;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  transition: all 0.2s;
}

.modern-select:focus, .modern-input:focus, .modern-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  background: #fff;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.icon-btn {
  padding: 0 12px;
  background: #f1f5f9;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.toggle-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* 提示词区域 */
.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.prompt-actions {
  display: flex;
  gap: 12px;
}

.action-link {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--primary-color);
  cursor: pointer;
  padding: 4px 8px;
  transition: all 0.2s;
  border-radius: 4px;
}

.action-link:hover {
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary-dark);
}

.text-btn {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  transition: all 0.2s;
  border-radius: 4px;
}

.text-btn:hover {
  background: #e2e8f0;
  color: var(--text-primary);
}

.magic-btn {
  color: var(--primary-color);
  font-weight: 500;
}

.modern-textarea.main-prompt {
  min-height: 120px;
  resize: vertical;
  line-height: 1.6;
  font-size: 14px;
}

.modern-textarea.sm {
  min-height: 90px;
  font-size: 13px;
  line-height: 1.5;
}

/* 弹出面板 */
.dropdown-panel, .system-prompt-panel, .polish-result-panel {
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-top: 12px;
  margin-bottom: 12px;
  overflow: hidden;
}

.system-prompt-panel {
  padding: 14px;
}

.template-list {
  max-height: 200px;
  overflow-y: auto;
}

.template-item {
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: background 0.2s;
}

.template-item:hover {
  background: #e2e8f0;
}

.template-item .name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.template-item .category {
  font-size: 11px;
  color: var(--text-secondary);
}

.panel-header {
  padding: 10px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.panel-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.polish-header {
  background: linear-gradient(to right, #6366f1, #8b5cf6);
  color: white;
  padding: 10px 14px;
  margin: 0;
}

.polish-content {
  padding: 14px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--text-primary);
  background: white;
}

.panel-footer {
  padding: 10px 14px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 10px;
  background: #f8fafc;
}

.btn-xs {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-xs.primary {
  background: var(--primary-color);
  color: white;
}

.btn-xs.primary:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.btn-xs.secondary {
  background: #e2e8f0;
  color: var(--text-primary);
}

.btn-xs.secondary:hover {
  background: #cbd5e1;
}

.close-icon {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: opacity 0.2s;
}

.close-icon:hover {
  opacity: 0.8;
}

/* 润色工具栏 */
.polish-toolbar {
  margin-top: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #f0f4ff 0%, #f8f5ff 100%);
  border: 1px solid #e0e4ff;
  border-radius: var(--radius-md);
}

.polish-toolbar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.toolbar-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
}

.polish-controls {
  display: flex;
  gap: 12px;
  align-items: stretch;
}

.polish-model-wrapper {
  display: flex;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.polish-model-select,
.polish-model-input {
  flex: 1;
  padding: 10px 12px;
  font-size: 13px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: white;
  min-width: 0;
}

.toggle-custom-btn {
  padding: 8px 14px;
  font-size: 12px;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.toggle-custom-btn:hover {
  background: #f8fafc;
  border-color: var(--primary-color);
}

.polish-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, var(--primary-color), #8b5cf6);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  flex-shrink: 0;
}

.polish-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.polish-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 参数网格 */
.params-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.segmented-control {
  display: flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: var(--radius-md);
}

.segmented-control button {
  flex: 1;
  padding: 6px;
  border: none;
  background: none;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
}

.segmented-control button.active {
  background: white;
  color: var(--primary-color);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}

/* 上传区域 */
.upload-area {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-area:hover {
  border-color: var(--primary-color);
  background: #f8fafc;
}

.upload-area.has-files {
  padding: 12px;
  border-style: solid;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--text-secondary);
}

.upload-placeholder .icon {
  font-size: 20px;
}

.file-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.file-thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--border-color);
}

.file-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-btn {
  position: absolute;
  top: 0;
  right: 0;
  background: rgba(0,0,0,0.5);
  color: white;
  border: none;
  width: 18px;
  height: 18px;
  font-size: 12px;
  cursor: pointer;
}

.add-more-btn {
  width: 60px;
  height: 60px;
  border: 1px dashed var(--border-color);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--text-secondary);
}

/* 底部提交区 */
.submit-area {
  margin-top: auto;
  padding-top: 16px;
}

.generate-btn-lg {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, var(--primary-color), #8b5cf6);
  color: white;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
}

.generate-btn-lg:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
}

.generate-btn-lg:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-message {
  text-align: center;
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.status-message.error {
  color: #ef4444;
}

/* 右侧展示区 */
.result-viewport {
  flex: 1;
  background: #f1f5f9;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* 结果容器 */
.result-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
}

.result-container.has-result {
  align-items: flex-start;
}

.empty-state-lg {
  text-align: center;
  color: var(--text-secondary);
}

.empty-state-lg .illustration {
  font-size: 64px;
  margin-bottom: 24px;
}

.image-showcase {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

.showcase-item {
  background: white;
  padding: 12px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.image-wrapper {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.image-wrapper img {
  width: 100%;
  display: block;
}

.image-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  padding: 20px;
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  justify-content: center;
}

.image-wrapper:hover .image-overlay {
  opacity: 1;
}

.overlay-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  padding: 8px 16px;
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover {
  background: rgba(255,255,255,0.3);
}

/* 图片下方的操作按钮 */
.showcase-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.showcase-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.showcase-btn.primary {
  background: linear-gradient(135deg, var(--primary-color), #8b5cf6);
  color: white;
}

.showcase-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.showcase-btn.secondary {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.showcase-btn.secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

/* 历史记录区域 - 底部列表 */
.history-section {
  border-top: 1px solid var(--border-color);
  background: white;
  flex-shrink: 0;
  max-height: 280px;
  display: flex;
  flex-direction: column;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  background: #f8fafc;
}

.history-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.clear-all-btn {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-all-btn:hover {
  background: #fecaca;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 10px;
  margin-bottom: 10px;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.history-item:last-child {
  margin-bottom: 0;
}

.history-item:hover {
  background: #f1f5f9;
  border-color: var(--primary-color);
}

.history-thumb {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: #e2e8f0;
}

.history-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}

.history-thumb:hover img {
  transform: scale(1.1);
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #94a3b8;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-prompt {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 4px;
}

.history-meta {
  font-size: 11px;
  color: var(--text-secondary);
}

.history-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.history-btn {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.history-btn.copy {
  background: #fef3c7;
  color: #d97706;
}

.history-btn.copy:hover {
  background: #fde68a;
}

.history-btn.view {
  background: #dbeafe;
  color: #2563eb;
}

.history-btn.view:hover {
  background: #bfdbfe;
}

.history-btn.delete {
  background: #fee2e2;
  color: #dc2626;
}

.history-btn.delete:hover {
  background: #fecaca;
}

/* 响应式调整 */
@media (max-width: 900px) {
  .image-generator {
    height: auto;
    overflow: visible;
  }
  
  .main-content {
    flex-direction: column;
    overflow: visible;
  }
  
  .config-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
  
  .result-viewport {
    min-height: 500px;
  }
  
  .api-config-dropdown {
    width: 95%;
    left: 2.5%;
  }

  /* 历史记录响应式 */
  .history-section {
    max-height: 350px;
  }

  .history-item {
    flex-wrap: wrap;
    gap: 12px;
  }

  .history-thumb {
    width: 50px;
    height: 50px;
  }

  .history-info {
    flex: 1 1 100%;
    order: 3;
  }

  .history-actions {
    order: 2;
  }

  .history-btn {
    font-size: 10px;
    padding: 5px 8px;
  }
}

/* Loading 动画 */
.loader {
  width: 20px;
  height: 20px;
  border: 2px solid #ffffff;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { userConfigApi, configApi, type UserApiConfig, type ServiceConfig, type EmailConfig } from '@/api'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const isLoading = ref(false)
const isSaving = ref(false)
const isSyncing = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

// 配置数据（用户级）
const config = ref<UserApiConfig | null>(null)

// 默认配置同步表单
const defaultForm = ref({
  server: '',
  key: '',
})
const syncServices = ref({
  sora: true,
  veo: true,
  geminiImage: true,
  grok: true,
  grokImage: true,
  doubao: true,
  kling: true,
})

// 编辑模式
const editMode = ref<{
  sora: boolean
  veo: boolean
  geminiImage: boolean
  grok: boolean
  grokImage: boolean
  doubao: boolean
  kling: boolean
}>({
  sora: false,
  veo: false,
  geminiImage: false,
  grok: false,
  grokImage: false,
  doubao: false,
  kling: false,
})

// 编辑表单数据
const editForm = ref<{
  sora: ServiceConfig
  veo: ServiceConfig
  geminiImage: ServiceConfig
  grok: ServiceConfig
  grokImage: ServiceConfig
  doubao: ServiceConfig
  kling: ServiceConfig
}>({
  sora: { server: '', key: '', characterServer: '', characterKey: '' },
  veo: { server: '', key: '' },
  geminiImage: { server: '', key: '' },
  grok: { server: '', key: '' },
  grokImage: { server: '', key: '' },
  doubao: { server: '', key: '', xiaohuminiServer: '', xiaohuminiKey: '' },
  kling: { server: '', key: '' },
})

// 显示消息
const showMessage = (msg: string, type: 'success' | 'error' = 'success') => {
  message.value = msg
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}

// 检测 API 地址末尾是否有 /
const hasTrailingSlash = (url: string) => !!url && url.endsWith('/')

// 加载配置
const loadConfig = async () => {
  isLoading.value = true
  try {
    const response = await userConfigApi.getConfig()
    config.value = response.data.data
  } catch (error: any) {
    showMessage(error.message || '加载配置失败', 'error')
  } finally {
    isLoading.value = false
  }
}

// 进入编辑模式
const enterEditMode = async (service: 'sora' | 'veo' | 'geminiImage' | 'grok' | 'grokImage' | 'doubao' | 'kling') => {
  // 获取完整配置（包含 API Key）
  try {
    const response = await userConfigApi.getFullConfig()
    const fullConfig = response.data.data
    
    if (service === 'sora') {
      editForm.value.sora = { ...fullConfig.sora }
    } else if (service === 'veo') {
      editForm.value.veo = { ...fullConfig.veo }
    } else if (service === 'geminiImage') {
      editForm.value.geminiImage = { ...fullConfig.geminiImage }
    } else if (service === 'grok') {
      editForm.value.grok = { ...fullConfig.grok }
    } else if (service === 'grokImage') {
      editForm.value.grokImage = { ...fullConfig.grokImage }
    } else if (service === 'doubao') {
      editForm.value.doubao = { ...fullConfig.doubao }
    } else if (service === 'kling') {
      editForm.value.kling = { ...fullConfig.kling }
    }
    
    editMode.value[service] = true
  } catch (error: any) {
    showMessage(error.message || '获取配置失败', 'error')
  }
}

// 取消编辑
const cancelEdit = (service: 'sora' | 'veo' | 'geminiImage' | 'grok' | 'grokImage' | 'doubao' | 'kling') => {
  editMode.value[service] = false
}

// 保存配置
const saveConfig = async (service: 'sora' | 'veo' | 'geminiImage' | 'grok' | 'grokImage' | 'doubao' | 'kling') => {
  isSaving.value = true
  try {
    const serviceConfig = editForm.value[service]
    await userConfigApi.updateServiceConfig(service, serviceConfig)
    
    // 重新加载配置
    await loadConfig()
    
    editMode.value[service] = false
    showMessage(`${getServiceName(service)} 配置已更新，立即生效！`, 'success')
  } catch (error: any) {
    showMessage(error.message || '保存配置失败', 'error')
  } finally {
    isSaving.value = false
  }
}

// 获取服务名称
const getServiceName = (service: string): string => {
  const names: Record<string, string> = {
    sora: 'Sora',
    veo: 'VEO',
    geminiImage: 'Gemini Image',
    grok: 'Grok',
    grokImage: 'Grok 生图',
    doubao: '豆包',
    kling: '可灵',
  }
  return names[service] || service
}

// 测试连接
const testConnection = async (service: 'sora' | 'veo' | 'geminiImage' | 'grok' | 'grokImage' | 'doubao' | 'kling') => {
  showMessage(`正在测试 ${getServiceName(service)} 连接...`, 'success')
  // TODO: 实现连接测试
  setTimeout(() => {
    showMessage(`${getServiceName(service)} 连接测试功能开发中`, 'success')
  }, 1000)
}

// 全选/取消全选同步服务
const toggleAllSyncServices = (value: boolean) => {
  syncServices.value.sora = value
  syncServices.value.veo = value
  syncServices.value.geminiImage = value
  syncServices.value.grok = value
  syncServices.value.grokImage = value
  syncServices.value.doubao = value
  syncServices.value.kling = value
}

// 同步默认配置到所有服务
const syncDefault = async () => {
  if (!defaultForm.value.server && !defaultForm.value.key) {
    showMessage('请至少填写 API 地址或 API Key', 'error')
    return
  }

  const selectedServices = Object.entries(syncServices.value)
    .filter(([_, checked]) => checked)
    .map(([service]) => service)

  if (selectedServices.length === 0) {
    showMessage('请至少选择一个要同步的服务', 'error')
    return
  }

  isSyncing.value = true
  try {
    const res = await userConfigApi.syncDefault(
      defaultForm.value.server,
      defaultForm.value.key,
      selectedServices,
    )
    await loadConfig()
    showMessage(res.data.message || '同步成功！配置已更新', 'success')
  } catch (error: any) {
    showMessage(error.response?.data?.message || error.message || '同步失败', 'error')
  } finally {
    isSyncing.value = false
  }
}

// ============ 邮箱 SMTP 配置（仅管理员） ============
const emailEditMode = ref(false)
const emailConfig = ref<EmailConfig | null>(null)
const emailEditForm = ref<EmailConfig>({
  smtpServer: '',
  smtpPort: 465,
  smtpSSL: true,
  smtpAccount: '',
  smtpToken: '',
  smtpFrom: '',
})

const loadEmailConfig = async () => {
  if (!authStore.isAdmin) return
  try {
    const res = await configApi.getConfig()
    emailConfig.value = res.data.data.email || null
  } catch (e: any) {
    // 静默失败
  }
}

const enterEmailEdit = async () => {
  try {
    const res = await configApi.getFullConfig()
    const email = res.data.data.email
    if (email) {
      emailEditForm.value = { ...email }
    }
    emailEditMode.value = true
  } catch (e: any) {
    showMessage(e.message || '获取邮箱配置失败', 'error')
  }
}

const saveEmailConfig = async () => {
  isSaving.value = true
  try {
    await configApi.updateServiceConfig('email', emailEditForm.value)
    await loadEmailConfig()
    emailEditMode.value = false
    showMessage('邮箱 SMTP 配置已更新，立即生效！', 'success')
  } catch (e: any) {
    showMessage(e.response?.data?.message || e.message || '保存失败', 'error')
  } finally {
    isSaving.value = false
  }
}

const cancelEmailEdit = () => {
  emailEditMode.value = false
}

// ============ 使用教程链接配置（仅管理员） ============
const tutorialEditMode = ref(false)
const tutorialUrl = ref('')
const tutorialEditUrl = ref('')

const loadTutorialConfig = async () => {
  if (!authStore.isAdmin) return
  try {
    const res = await configApi.getConfig()
    tutorialUrl.value = res.data.data.tutorialUrl || ''
  } catch {}
}

const enterTutorialEdit = () => {
  tutorialEditUrl.value = tutorialUrl.value
  tutorialEditMode.value = true
}

const saveTutorialConfig = async () => {
  isSaving.value = true
  try {
    await configApi.updateServiceConfig('tutorial', { url: tutorialEditUrl.value.trim() })
    await loadTutorialConfig()
    tutorialEditMode.value = false
    showMessage('使用教程链接已更新！', 'success')
  } catch (e: any) {
    showMessage(e.response?.data?.message || e.message || '保存失败', 'error')
  } finally {
    isSaving.value = false
  }
}

const cancelTutorialEdit = () => {
  tutorialEditMode.value = false
}

// ============ 二维码图片配置（仅管理员） ============
const qrcodeEditMode = ref(false)
const qrcodeUrl = ref('')
const qrcodeEditUrl = ref('')

const loadQrcodeConfig = async () => {
  if (!authStore.isAdmin) return
  try {
    const res = await configApi.getConfig()
    qrcodeUrl.value = res.data.data.qrcodeUrl || ''
  } catch {}
}

const enterQrcodeEdit = () => {
  qrcodeEditUrl.value = qrcodeUrl.value
  qrcodeEditMode.value = true
}

const saveQrcodeConfig = async () => {
  isSaving.value = true
  try {
    await configApi.updateServiceConfig('qrcode', { url: qrcodeEditUrl.value.trim() })
    await loadQrcodeConfig()
    qrcodeEditMode.value = false
    showMessage('二维码图片链接已更新！', 'success')
  } catch (e: any) {
    showMessage(e.response?.data?.message || e.message || '保存失败', 'error')
  } finally {
    isSaving.value = false
  }
}

const cancelQrcodeEdit = () => {
  qrcodeEditMode.value = false
}

// ============ 页脚内容配置（仅管理员） ============
const footerEditMode = ref(false)
const footerContent = ref('')
const footerEditContent = ref('')

const loadFooterConfig = async () => {
  if (!authStore.isAdmin) return
  try {
    const res = await configApi.getConfig()
    footerContent.value = res.data.data.footerContent || ''
  } catch {}
}

const enterFooterEdit = () => {
  footerEditContent.value = footerContent.value
  footerEditMode.value = true
}

const saveFooterConfig = async () => {
  isSaving.value = true
  try {
    await configApi.updateServiceConfig('footer', { content: footerEditContent.value })
    await loadFooterConfig()
    footerEditMode.value = false
    showMessage('页脚内容已更新！', 'success')
  } catch (e: any) {
    showMessage(e.response?.data?.message || e.message || '保存失败', 'error')
  } finally {
    isSaving.value = false
  }
}

const cancelFooterEdit = () => {
  footerEditMode.value = false
}

onMounted(() => {
  loadConfig()
  loadEmailConfig()
  loadTutorialConfig()
  loadQrcodeConfig()
  loadFooterConfig()
})
</script>

<template>
  <div class="config-page">
    <h1>⚙️ 我的 API 配置</h1>
    
    <!-- 消息提示 -->
    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading">
      加载中...
    </div>

    <div v-else-if="config" class="config-sections">
      <!-- 默认配置快捷同步 -->
      <div class="config-section sync-section">
        <div class="section-header">
          <h2>🔗 快捷配置同步</h2>
        </div>
        <p class="sync-desc">
          如果您的 API 服务商使用同一个地址和密钥即可调用所有模型，可在此统一设置后一键同步到下方所有服务配置，同步后仍可单独修改任意一项。
        </p>
        <div class="config-edit">
          <div class="form-group">
            <label>默认 API 地址</label>
            <input v-model="defaultForm.server" type="text" placeholder="https://api.example.com" />
            <span v-if="hasTrailingSlash(defaultForm.server)" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
          </div>
          <div class="form-group">
            <label>默认 API Key</label>
            <input v-model="defaultForm.key" type="text" placeholder="sk-..." />
          </div>
          <div class="form-group">
            <div class="sync-label-row">
              <label>同步到以下服务</label>
              <div class="sync-toggle-buttons">
                <button class="toggle-btn" @click="toggleAllSyncServices(true)">全选</button>
                <button class="toggle-btn" @click="toggleAllSyncServices(false)">取消全选</button>
              </div>
            </div>
            <div class="sync-checkboxes">
              <label class="checkbox-label">
                <input v-model="syncServices.sora" type="checkbox" /> Sora
              </label>
              <label class="checkbox-label">
                <input v-model="syncServices.veo" type="checkbox" /> VEO
              </label>
              <label class="checkbox-label">
                <input v-model="syncServices.geminiImage" type="checkbox" /> Gemini Image
              </label>
              <label class="checkbox-label">
                <input v-model="syncServices.grok" type="checkbox" /> Grok 视频
              </label>
              <label class="checkbox-label">
                <input v-model="syncServices.grokImage" type="checkbox" /> Grok 生图
              </label>
              <label class="checkbox-label">
                <input v-model="syncServices.doubao" type="checkbox" /> 豆包
              </label>
              <label class="checkbox-label">
                <input v-model="syncServices.kling" type="checkbox" /> 可灵
              </label>
            </div>
          </div>
          <div class="button-group">
            <button class="save-btn sync-btn" :disabled="isSyncing" @click="syncDefault">
              {{ isSyncing ? '同步中...' : '🔄 一键同步到所选服务' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Sora 配置 -->
      <div class="config-section">
        <div class="section-header">
          <h2>🎬 Sora 视频生成</h2>
          <button 
            v-if="!editMode.sora" 
            class="edit-btn"
            @click="enterEditMode('sora')"
          >
            ✏️ 编辑
          </button>
        </div>
        
        <div v-if="!editMode.sora" class="config-display">
          <div class="config-item">
            <label>API 地址</label>
            <span class="value">{{ config.sora.server }}</span>
            <span v-if="hasTrailingSlash(config.sora.server)" class="field-warning">⚠️ API 地址末尾不需要 /，请编辑删除</span>
          </div>
          <div class="config-item">
            <label>API Key</label>
            <span class="value masked">{{ config.sora.key }}</span>
          </div>
          <div class="config-item">
            <label>角色服务地址</label>
            <span class="value">{{ config.sora.characterServer || '(未设置)' }}</span>
            <span v-if="hasTrailingSlash(config.sora.characterServer || '')" class="field-warning">⚠️ API 地址末尾不需要 /，请编辑删除</span>
          </div>
          <div class="config-item">
            <label>角色服务 Key</label>
            <span class="value masked">{{ config.sora.characterKey || '(未设置)' }}</span>
          </div>
        </div>

        <div v-else class="config-edit">
          <div class="form-group">
            <label>API 地址</label>
            <input v-model="editForm.sora.server" type="text" placeholder="https://..." />
            <span v-if="hasTrailingSlash(editForm.sora.server)" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input v-model="editForm.sora.key" type="text" placeholder="sk-..." />
          </div>
          <div class="form-group">
            <label>角色服务地址</label>
            <input v-model="editForm.sora.characterServer" type="text" placeholder="https://..." />
            <span v-if="hasTrailingSlash(editForm.sora.characterServer || '')" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
          </div>
          <div class="form-group">
            <label>角色服务 Key</label>
            <input v-model="editForm.sora.characterKey" type="text" placeholder="sk-..." />
          </div>
          <div class="button-group">
            <button class="save-btn" :disabled="isSaving" @click="saveConfig('sora')">
              {{ isSaving ? '保存中...' : '💾 保存' }}
            </button>
            <button class="cancel-btn" @click="cancelEdit('sora')">取消</button>
          </div>
        </div>
      </div>

      <!-- VEO 配置 -->
      <div class="config-section">
        <div class="section-header">
          <h2>🎥 VEO 视频生成</h2>
          <button 
            v-if="!editMode.veo" 
            class="edit-btn"
            @click="enterEditMode('veo')"
          >
            ✏️ 编辑
          </button>
        </div>
        
        <div v-if="!editMode.veo" class="config-display">
          <div class="config-item">
            <label>API 地址</label>
            <span class="value">{{ config.veo.server }}</span>
            <span v-if="hasTrailingSlash(config.veo.server)" class="field-warning">⚠️ API 地址末尾不需要 /，请编辑删除</span>
          </div>
          <div class="config-item">
            <label>API Key</label>
            <span class="value masked">{{ config.veo.key }}</span>
          </div>
        </div>

        <div v-else class="config-edit">
          <div class="form-group">
            <label>API 地址</label>
            <input v-model="editForm.veo.server" type="text" placeholder="https://..." />
            <span v-if="hasTrailingSlash(editForm.veo.server)" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input v-model="editForm.veo.key" type="text" placeholder="sk-..." />
          </div>
          <div class="button-group">
            <button class="save-btn" :disabled="isSaving" @click="saveConfig('veo')">
              {{ isSaving ? '保存中...' : '💾 保存' }}
            </button>
            <button class="cancel-btn" @click="cancelEdit('veo')">取消</button>
          </div>
        </div>
      </div>

      <!-- Gemini Image 配置 -->
      <div class="config-section">
        <div class="section-header">
          <h2>🎨 Gemini 图片生成</h2>
          <button 
            v-if="!editMode.geminiImage" 
            class="edit-btn"
            @click="enterEditMode('geminiImage')"
          >
            ✏️ 编辑
          </button>
        </div>
        
        <div v-if="!editMode.geminiImage" class="config-display">
          <div class="config-item">
            <label>API 地址</label>
            <span class="value">{{ config.geminiImage.server }}</span>
            <span v-if="hasTrailingSlash(config.geminiImage.server)" class="field-warning">⚠️ API 地址末尾不需要 /，请编辑删除</span>
          </div>
          <div class="config-item">
            <label>API Key</label>
            <span class="value masked">{{ config.geminiImage.key }}</span>
          </div>
        </div>

        <div v-else class="config-edit">
          <div class="form-group">
            <label>API 地址</label>
            <input v-model="editForm.geminiImage.server" type="text" placeholder="https://..." />
            <span v-if="hasTrailingSlash(editForm.geminiImage.server)" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input v-model="editForm.geminiImage.key" type="text" placeholder="sk-..." />
          </div>
          <div class="button-group">
            <button class="save-btn" :disabled="isSaving" @click="saveConfig('geminiImage')">
              {{ isSaving ? '保存中...' : '💾 保存' }}
            </button>
            <button class="cancel-btn" @click="cancelEdit('geminiImage')">取消</button>
          </div>
        </div>
      </div>

      <!-- 说明 -->
      <div class="config-section">
        <div class="section-header">
          <h2>⚡ Grok 视频生成</h2>
          <button 
            v-if="!editMode.grok" 
            class="edit-btn"
            @click="enterEditMode('grok')"
          >
            ✏️ 编辑
          </button>
        </div>
        
        <div v-if="!editMode.grok" class="config-display">
          <div class="config-item">
            <label>API 地址</label>
            <span class="value">{{ config.grok?.server || '(未设置)' }}</span>
            <span v-if="hasTrailingSlash(config.grok?.server || '')" class="field-warning">⚠️ API 地址末尾不需要 /，请编辑删除</span>
          </div>
          <div class="config-item">
            <label>API Key</label>
            <span class="value masked">{{ config.grok?.key || '(未设置)' }}</span>
          </div>
        </div>

        <div v-else class="config-edit">
          <div class="form-group">
            <label>API 地址</label>
            <input v-model="editForm.grok.server" type="text" placeholder="https://..." />
            <span v-if="hasTrailingSlash(editForm.grok.server)" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input v-model="editForm.grok.key" type="text" placeholder="sk-..." />
          </div>
          <div class="button-group">
            <button class="save-btn" :disabled="isSaving" @click="saveConfig('grok')">
              {{ isSaving ? '保存中...' : '💾 保存' }}
            </button>
            <button class="cancel-btn" @click="cancelEdit('grok')">取消</button>
          </div>
        </div>
      </div>

      <!-- Grok 图片生成配置 -->
      <div class="config-section">
        <div class="section-header">
          <h2>🎨 Grok 图片生成</h2>
          <button 
            v-if="!editMode.grokImage" 
            class="edit-btn"
            @click="enterEditMode('grokImage')"
          >
            ✏️ 编辑
          </button>
        </div>
        
        <div v-if="!editMode.grokImage" class="config-display">
          <div class="config-item">
            <label>API 地址</label>
            <span class="value">{{ config.grokImage?.server || '(未设置)' }}</span>
            <span v-if="hasTrailingSlash(config.grokImage?.server || '')" class="field-warning">⚠️ API 地址末尾不需要 /，请编辑删除</span>
          </div>
          <div class="config-item">
            <label>API Key</label>
            <span class="value masked">{{ config.grokImage?.key || '(未设置)' }}</span>
          </div>
        </div>

        <div v-else class="config-edit">
          <div class="form-group">
            <label>API 地址</label>
            <input v-model="editForm.grokImage.server" type="text" placeholder="https://..." />
            <span v-if="hasTrailingSlash(editForm.grokImage.server)" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input v-model="editForm.grokImage.key" type="text" placeholder="sk-..." />
          </div>
          <div class="button-group">
            <button class="save-btn" :disabled="isSaving" @click="saveConfig('grokImage')">
              {{ isSaving ? '保存中...' : '💾 保存' }}
            </button>
            <button class="cancel-btn" @click="cancelEdit('grokImage')">取消</button>
          </div>
        </div>
      </div>

      <!-- 豆包视频配置 -->
      <div class="config-section">
        <div class="section-header">
          <h2>🫘 豆包视频生成</h2>
          <button 
            v-if="!editMode.doubao" 
            class="edit-btn"
            @click="enterEditMode('doubao')"
          >
            ✏️ 编辑
          </button>
        </div>
        
        <div v-if="!editMode.doubao" class="config-display">
          <div class="config-item">
            <label>aifast API 地址</label>
            <span class="value">{{ config.doubao?.server || '(未设置)' }}</span>
            <span v-if="hasTrailingSlash(config.doubao?.server || '')" class="field-warning">⚠️ API 地址末尾不需要 /，请编辑删除</span>
          </div>
          <div class="config-item">
            <label>aifast API Key</label>
            <span class="value masked">{{ config.doubao?.key || '(未设置)' }}</span>
          </div>
          <div class="config-item">
            <label>xiaohumini API 地址</label>
            <span class="value">{{ config.doubao?.xiaohuminiServer || '(未设置，将回退到 aifast 地址)' }}</span>
            <span v-if="hasTrailingSlash(config.doubao?.xiaohuminiServer || '')" class="field-warning">⚠️ API 地址末尾不需要 /，请编辑删除</span>
          </div>
          <div class="config-item">
            <label>xiaohumini API Key</label>
            <span class="value masked">{{ config.doubao?.xiaohuminiKey || '(未设置，将回退到 aifast Key)' }}</span>
          </div>
        </div>

        <div v-else class="config-edit">
          <p class="edit-hint" style="margin: 0 0 8px; font-size: 12px; color: #999;">aifast 渠道配置</p>
          <div class="form-group">
            <label>aifast API 地址</label>
            <input v-model="editForm.doubao.server" type="text" placeholder="https://..." />
            <span v-if="hasTrailingSlash(editForm.doubao.server)" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
          </div>
          <div class="form-group">
            <label>aifast API Key</label>
            <input v-model="editForm.doubao.key" type="text" placeholder="sk-..." />
          </div>
          <p class="edit-hint" style="margin: 12px 0 8px; font-size: 12px; color: #999;">xiaohumini 渠道配置（留空则回退到 aifast 配置）</p>
          <div class="form-group">
            <label>xiaohumini API 地址</label>
            <input v-model="editForm.doubao.xiaohuminiServer" type="text" placeholder="https://...（留空回退 aifast 地址）" />
            <span v-if="hasTrailingSlash(editForm.doubao.xiaohuminiServer || '')" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
          </div>
          <div class="form-group">
            <label>xiaohumini API Key</label>
            <input v-model="editForm.doubao.xiaohuminiKey" type="text" placeholder="sk-...（留空回退 aifast Key）" />
          </div>
          <div class="button-group">
            <button class="save-btn" :disabled="isSaving" @click="saveConfig('doubao')">
              {{ isSaving ? '保存中...' : '💾 保存' }}
            </button>
            <button class="cancel-btn" @click="cancelEdit('doubao')">取消</button>
          </div>
        </div>
      </div>

      <!-- 可灵 (Kling) 配置 -->
      <div class="config-section">
        <div class="section-header">
          <h2>🎞️ 可灵视频生成</h2>
          <button 
            v-if="!editMode.kling" 
            class="edit-btn"
            @click="enterEditMode('kling')"
          >
            ✏️ 编辑
          </button>
        </div>
        
        <div v-if="!editMode.kling" class="config-display">
          <div class="config-item">
            <label>API 地址</label>
            <span class="value">{{ config.kling?.server || '(未设置)' }}</span>
            <span v-if="hasTrailingSlash(config.kling?.server || '')" class="field-warning">⚠️ API 地址末尾不需要 /，请编辑删除</span>
          </div>
          <div class="config-item">
            <label>API Key</label>
            <span class="value masked">{{ config.kling?.key || '(未设置)' }}</span>
          </div>
        </div>

        <div v-else class="config-edit">
          <div class="form-group">
            <label>API 地址</label>
            <input v-model="editForm.kling.server" type="text" placeholder="https://..." />
            <span v-if="hasTrailingSlash(editForm.kling.server)" class="field-warning">⚠️ API 地址末尾不需要 /，请删除</span>
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input v-model="editForm.kling.key" type="text" placeholder="sk-..." />
          </div>
          <div class="button-group">
            <button class="save-btn" :disabled="isSaving" @click="saveConfig('kling')">
              {{ isSaving ? '保存中...' : '💾 保存' }}
            </button>
            <button class="cancel-btn" @click="cancelEdit('kling')">取消</button>
          </div>
        </div>
      </div>

      <!-- 使用教程链接配置（仅管理员可见） -->
      <div v-if="authStore.isAdmin" class="config-section tutorial-section">
        <div class="section-header">
          <h2>📖 使用教程链接</h2>
          <button
            v-if="!tutorialEditMode"
            class="edit-btn"
            @click="enterTutorialEdit"
          >
            ✏️ 编辑
          </button>
        </div>

        <div v-if="!tutorialEditMode" class="config-display">
          <div class="config-item">
            <label>教程链接</label>
            <span v-if="tutorialUrl" class="value">
              <a :href="tutorialUrl" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: underline;">{{ tutorialUrl }}</a>
            </span>
            <span v-else class="value" style="color: #999;">(未设置，设置后导航栏将显示「使用教程」菜单)</span>
          </div>
        </div>

        <div v-else class="config-edit">
          <div class="form-group">
            <label>教程链接 URL</label>
            <input v-model="tutorialEditUrl" type="text" placeholder="https://example.com/tutorial" />
          </div>
          <p style="color: #999; font-size: 12px; margin-bottom: 12px;">提示：设置后导航栏将显示「📖 使用教程」菜单，用户点击即可跳转。清空链接则隐藏菜单。</p>
          <div class="button-group">
            <button class="save-btn" :disabled="isSaving" @click="saveTutorialConfig">
              {{ isSaving ? '保存中...' : '💾 保存' }}
            </button>
            <button class="cancel-btn" @click="cancelTutorialEdit">取消</button>
          </div>
        </div>
      </div>

      <!-- 邮箱 SMTP 配置（仅管理员可见） -->
      <div v-if="authStore.isAdmin" class="config-section email-section">
        <div class="section-header">
          <h2>📧 邮箱 SMTP 配置</h2>
          <button
            v-if="!emailEditMode"
            class="edit-btn"
            @click="enterEmailEdit"
          >
            ✏️ 编辑
          </button>
        </div>

        <div v-if="!emailEditMode && emailConfig" class="config-display">
          <div class="config-item">
            <label>SMTP 服务器</label>
            <span class="value">{{ emailConfig.smtpServer || '(未设置)' }}</span>
          </div>
          <div class="config-item">
            <label>端口</label>
            <span class="value">{{ emailConfig.smtpPort }}</span>
          </div>
          <div class="config-item">
            <label>SSL</label>
            <span class="value">{{ emailConfig.smtpSSL ? '✅ 已启用' : '❌ 未启用' }}</span>
          </div>
          <div class="config-item">
            <label>账号</label>
            <span class="value">{{ emailConfig.smtpAccount || '(未设置)' }}</span>
          </div>
          <div class="config-item">
            <label>授权码</label>
            <span class="value masked">{{ emailConfig.smtpToken || '(未设置)' }}</span>
          </div>
          <div class="config-item">
            <label>发件人</label>
            <span class="value">{{ emailConfig.smtpFrom || '(未设置)' }}</span>
          </div>
        </div>

        <div v-else-if="emailEditMode" class="config-edit">
          <div class="form-group">
            <label>SMTP 服务器</label>
            <input v-model="emailEditForm.smtpServer" type="text" placeholder="smtp.163.com" />
          </div>
          <div class="form-group">
            <label>端口</label>
            <input v-model.number="emailEditForm.smtpPort" type="number" placeholder="465" />
          </div>
          <div class="form-group">
            <label>SSL</label>
            <div class="ssl-toggle">
              <label class="checkbox-label">
                <input v-model="emailEditForm.smtpSSL" type="checkbox" /> 启用 SSL 加密
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>SMTP 账号</label>
            <input v-model="emailEditForm.smtpAccount" type="text" placeholder="user@163.com" />
          </div>
          <div class="form-group">
            <label>SMTP 授权码</label>
            <input v-model="emailEditForm.smtpToken" type="text" placeholder="邮箱授权码（非登录密码）" />
          </div>
          <div class="form-group">
            <label>发件人地址</label>
            <input v-model="emailEditForm.smtpFrom" type="text" placeholder="user@163.com" />
          </div>
          <div class="button-group">
            <button class="save-btn" :disabled="isSaving" @click="saveEmailConfig">
              {{ isSaving ? '保存中...' : '💾 保存' }}
            </button>
            <button class="cancel-btn" @click="cancelEmailEdit">取消</button>
          </div>
        </div>

        <div v-else class="config-display">
          <p style="color: #999;">加载中...</p>
        </div>
      </div>

      <!-- 二维码图片配置（仅管理员可见） -->
      <div v-if="authStore.isAdmin" class="config-section qrcode-section">
        <div class="section-header">
          <h2>📱 项目沟通群二维码</h2>
          <button
            v-if="!qrcodeEditMode"
            class="edit-btn"
            @click="enterQrcodeEdit"
          >
            ✏️ 编辑
          </button>
        </div>

        <div v-if="!qrcodeEditMode" class="config-display">
          <div class="config-item">
            <label>二维码图片 URL</label>
            <span v-if="qrcodeUrl" class="value">
              <a :href="qrcodeUrl" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: underline;">{{ qrcodeUrl }}</a>
            </span>
            <span v-else class="value" style="color: #999;">(未设置，设置后页面右下角将显示悬浮二维码)</span>
          </div>
          <div v-if="qrcodeUrl" class="qrcode-preview">
            <label>预览</label>
            <img :src="qrcodeUrl" alt="二维码预览" style="max-width: 150px; border-radius: 8px; border: 1px solid #eee;" />
          </div>
        </div>

        <div v-else class="config-edit">
          <div class="form-group">
            <label>二维码图片 URL</label>
            <input v-model="qrcodeEditUrl" type="text" placeholder="https://example.com/qrcode.png" />
          </div>
          <p style="color: #999; font-size: 12px; margin-bottom: 12px;">提示：设置后页面右下角将显示悬浮二维码图片，用户鼠标悬停可放大查看。清空链接则隐藏二维码。</p>
          <div class="button-group">
            <button class="save-btn" :disabled="isSaving" @click="saveQrcodeConfig">
              {{ isSaving ? '保存中...' : '💾 保存' }}
            </button>
            <button class="cancel-btn" @click="cancelQrcodeEdit">取消</button>
          </div>
        </div>
      </div>

      <!-- 页脚内容配置（仅管理员可见） -->
      <div v-if="authStore.isAdmin" class="config-section footer-section">
        <div class="section-header">
          <h2>📄 页脚设置</h2>
          <button
            v-if="!footerEditMode"
            class="edit-btn"
            @click="enterFooterEdit"
          >
            ✏️ 编辑
          </button>
        </div>

        <div v-if="!footerEditMode" class="config-display">
          <div class="config-item">
            <label>页脚内容</label>
            <span v-if="footerContent" class="value">{{ footerContent }}</span>
            <span v-else class="value" style="color: #999;">(未设置，设置后页面底部将显示页脚信息)</span>
          </div>
        </div>

        <div v-else class="config-edit">
          <div class="form-group">
            <label>页脚内容</label>
            <textarea v-model="footerEditContent" rows="3" placeholder="例如：© 2026 AI 创作平台 | 联系邮箱：admin@example.com" style="padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; resize: vertical; font-family: inherit;"></textarea>
          </div>
          <p style="color: #999; font-size: 12px; margin-bottom: 12px;">提示：页脚内容将显示在页面底部，支持纯文本。清空内容则隐藏页脚。</p>
          <div class="button-group">
            <button class="save-btn" :disabled="isSaving" @click="saveFooterConfig">
              {{ isSaving ? '保存中...' : '💾 保存' }}
            </button>
            <button class="cancel-btn" @click="cancelFooterEdit">取消</button>
          </div>
        </div>
      </div>

      <!-- 说明 -->
      <div class="info-section">
        <h3>📝 说明</h3>
        <ul>
          <li>每个用户拥有独立的 API 配置，修改后<strong>立即生效</strong></li>
          <li>API Key 以脱敏方式显示，编辑时可查看完整内容</li>
          <li>新用户的配置自动从模板初始化，配置存储在 MongoDB 中</li>
          <li><strong>快捷同步：</strong>如果 API 服务商共用地址和密钥，可使用顶部「快捷配置同步」一键填充，同步后仍可单独修改</li>
          <li v-if="authStore.isAdmin"><strong>邮箱配置（管理员）：</strong>用于邮箱验证码登录功能，修改后立即生效无需重启</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.field-warning {
  display: block;
  color: #e67e22;
  font-size: 12px;
  margin-top: 4px;
  font-weight: 500;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

.message {
  padding: 12px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: center;
  font-weight: 500;
}

.message.success {
  background: #d4edda;
  color: #155724;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
}

.loading {
  text-align: center;
  padding: 60px;
  color: #666;
  font-size: 18px;
}

.config-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.section-header h2 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.edit-btn {
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.edit-btn:hover {
  background: #5a6fd6;
}

.config-display {
  display: grid;
  gap: 16px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.config-item label {
  min-width: 120px;
  font-weight: 500;
  color: #555;
}

.config-item .value {
  flex: 1;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  font-family: monospace;
  color: #333;
  word-break: break-all;
}

.config-item .value.masked {
  color: #888;
}

.config-edit {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-weight: 500;
  color: #555;
  font-size: 14px;
}

.form-group input {
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  font-family: monospace;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.button-group {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.save-btn {
  padding: 10px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: transform 0.2s, box-shadow 0.2s;
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  padding: 10px 24px;
  background: #f0f0f0;
  color: #666;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

.info-section {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px 24px;
}

.info-section h3 {
  margin: 0 0 12px;
  font-size: 16px;
  color: #333;
}

.info-section ul {
  margin: 0;
  padding-left: 20px;
}

.info-section li {
  color: #666;
  line-height: 1.8;
}

.info-section code {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.sync-section {
  border: 2px dashed #667eea;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
}

.sync-desc {
  color: #666;
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 16px;
}

.sync-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.sync-label-row label {
  margin-bottom: 0;
}

.sync-toggle-buttons {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  padding: 2px 12px;
  font-size: 12px;
  border: 1px solid #667eea;
  border-radius: 4px;
  background: transparent;
  color: #667eea;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: #667eea;
  color: #fff;
}

.sync-checkboxes {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #444;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #667eea;
  cursor: pointer;
}

.sync-btn {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%) !important;
  color: #1a1a2e !important;
  font-weight: 600 !important;
}

.email-section {
  border-left: 4px solid #667eea;
}

.tutorial-section {
  border-left: 4px solid #22c55e;
}

.qrcode-section {
  border-left: 4px solid #f59e0b;
}

.qrcode-preview {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-top: 12px;
}

.qrcode-preview label {
  min-width: 120px;
  font-weight: 500;
  color: #555;
  padding-top: 4px;
}

.footer-section {
  border-left: 4px solid #8b5cf6;
}

.footer-section textarea {
  width: 100%;
  box-sizing: border-box;
}

.ssl-toggle {
  padding: 4px 0;
}

@media (max-width: 600px) {
  .config-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .config-item label {
    min-width: auto;
  }
  
  .config-item .value {
    width: 100%;
  }
}
</style>

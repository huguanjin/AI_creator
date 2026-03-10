import axios from 'axios'

// NestJS 后端地址
// 开发模式: VITE_API_BASE=http://localhost:3003
// 生产/Docker 模式: 留空，由 Nginx 反向代理 /v1/ 到后端
const API_BASE = import.meta.env.VITE_API_BASE || ''

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 调试：打印请求
api.interceptors.request.use((config) => {
  // 自动附加 JWT token
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  console.log('📤 API Request:', config.method?.toUpperCase(), config.url)
  console.log('📦 Request Data:', config.data)
  return config
})

// 响应拦截器：处理 401 自动跳转登录
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 如果不是登录接口返回的 401，则清除 token 并跳转
      const url = error.config?.url || ''
      if (!url.includes('/v1/auth/login')) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_userId')
        localStorage.removeItem('auth_username')
        localStorage.removeItem('auth_role')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

// ============ Auth API ============

export const authApi = {
  // 登录
  login: (username: string, password: string) =>
    api.post<{ status: string; data: { token: string; userId: string; username: string; role: string } }>(
      '/v1/auth/login',
      { username, password },
    ),

  // 注册
  register: (username: string, password: string) =>
    api.post<{ status: string; data: { token: string; userId: string; username: string; role: string } }>(
      '/v1/auth/register',
      { username, password },
    ),

  // 获取用户信息
  getProfile: () =>
    api.get('/v1/auth/profile'),

  // 修改密码
  changePassword: (oldPassword: string, newPassword: string) =>
    api.put('/v1/auth/password', { oldPassword, newPassword }),

  // 验证 token
  verify: () =>
    api.get('/v1/auth/verify'),

  // 发送邮箱验证码
  sendEmailCode: (email: string) =>
    api.post<{ status: string; message: string }>(
      '/v1/auth/email/send-code',
      { email },
    ),

  // 邮箱验证码登录
  emailLogin: (email: string, code: string) =>
    api.post<{ status: string; data: { token: string; userId: string; username: string; role: string } }>(
      '/v1/auth/email/login',
      { email, code },
    ),
}

// ============ Sora API ============

export interface CreateSoraVideoParams {
  model: string
  prompt: string
  size?: '720x1280' | '1280x720'
  seconds?: number
  character_url?: string
  character_timestamps?: string
}

export interface CreateCharacterParams {
  url?: string
  timestamps: string
  from_task?: string
}

export const soraApi = {
  // 创建视频（支持参考图上传）
  createVideo: (params: CreateSoraVideoParams, files?: File[]) => {
    const formData = new FormData()
    formData.append('model', params.model)
    formData.append('prompt', params.prompt)
    if (params.size) formData.append('size', params.size)
    if (params.seconds) formData.append('seconds', String(params.seconds))
    if (params.character_url) formData.append('character_url', params.character_url)
    if (params.character_timestamps) formData.append('character_timestamps', params.character_timestamps)

    // 添加参考图
    if (files && files.length > 0) {
      for (const file of files) {
        formData.append('input_reference', file)
      }
    }

    return api.post('/v1/video/create', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // 查询视频状态
  queryVideo: (id: string) =>
    api.get(`/v1/video/query?id=${encodeURIComponent(id)}`),

  // 创建角色
  createCharacter: (params: CreateCharacterParams) =>
    api.post('/v1/video/character', params),
}

// ============ VEO API ============

export interface CreateVeoVideoParams {
  model: string
  prompt: string
  size?: '720x1280' | '1280x720'
  seconds?: number
  enable_upsample?: boolean
}

export const veoApi = {
  // 创建视频（支持参考图上传）
  createVideo: (params: CreateVeoVideoParams, files?: File[]) => {
    const formData = new FormData()
    formData.append('model', params.model)
    formData.append('prompt', params.prompt)
    if (params.size) formData.append('size', params.size)
    if (params.seconds) formData.append('seconds', String(params.seconds))
    
    // 添加参考图
    if (files && files.length > 0) {
      for (const file of files) {
        formData.append('input_reference', file)
      }
    }
    
    return api.post('/v1/veo/create', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // 查询视频状态
  queryVideo: (id: string) =>
    api.get(`/v1/veo/query?id=${encodeURIComponent(id)}`),
}

// ============ Grok API ============

export interface CreateGrokVideoParams {
  model: string
  prompt: string
  aspect_ratio?: '2:3' | '3:2' | '1:1'
  seconds?: number
  size?: '720P' | '1080P'
  channel?: 'aifast' | 'xiaohumini'
  images?: string[]
}

export const grokApi = {
  // 创建视频（支持参考图上传）
  createVideo: (params: CreateGrokVideoParams, files?: File[]) => {
    const formData = new FormData()
    if (params.channel) formData.append('channel', params.channel)
    formData.append('model', params.model)
    formData.append('prompt', params.prompt)
    if (params.aspect_ratio) formData.append('aspect_ratio', params.aspect_ratio)
    if (params.seconds) formData.append('seconds', String(params.seconds))
    if (params.size) formData.append('size', params.size)

    // xiaohumini 渠道：传图片URL列表
    if (params.channel === 'xiaohumini' && params.images && params.images.length > 0) {
      formData.append('images', JSON.stringify(params.images))
    }

    // 上传参考图文件（两个渠道都支持）
    if (files && files.length > 0) {
      for (const file of files) {
        formData.append('input_reference', file)
      }
    }

    return api.post('/v1/grok/create', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // 查询视频状态
  queryVideo: (id: string, channel?: string) =>
    api.get(`/v1/grok/query?id=${encodeURIComponent(id)}${channel ? `&channel=${encodeURIComponent(channel)}` : ''}`),
}

// ============ 豆包 API ============

export interface CreateDoubaoVideoParams {
  model: string
  prompt: string
  size?: string
  seconds?: number
  channel?: 'aifast' | 'xiaohumini'
  // xiaohumini 渠道参数
  resolution?: string
  camera_fixed?: string
  watermark?: string
  seed?: number
  generate_audio?: string
  images?: string[]
}

export const doubaoApi = {
  // 创建视频（支持首帧/尾帧/参考图上传）
  createVideo: (params: CreateDoubaoVideoParams, firstFrame?: File, lastFrame?: File, referenceFiles?: File[]) => {
    const formData = new FormData()
    if (params.channel) formData.append('channel', params.channel)
    formData.append('model', params.model)
    formData.append('prompt', params.prompt)
    if (params.size) formData.append('size', params.size)
    if (params.seconds) formData.append('seconds', String(params.seconds))

    // xiaohumini 渠道参数
    if (params.resolution) formData.append('resolution', params.resolution)
    if (params.camera_fixed) formData.append('camera_fixed', params.camera_fixed)
    if (params.watermark) formData.append('watermark', params.watermark)
    if (params.seed !== undefined && params.seed !== null && params.seed !== -1) formData.append('seed', String(params.seed))
    if (params.generate_audio) formData.append('generate_audio', params.generate_audio)

    // xiaohumini 渠道图片URL列表
    if (params.channel === 'xiaohumini' && params.images && params.images.length > 0) {
      formData.append('images', JSON.stringify(params.images))
    }

    // 首帧图片
    if (firstFrame) {
      formData.append('first_frame_image', firstFrame)
    }
    // 尾帧图片
    if (lastFrame) {
      formData.append('last_frame_image', lastFrame)
    }
    // 参考图
    if (referenceFiles && referenceFiles.length > 0) {
      for (const file of referenceFiles) {
        formData.append('reference_images', file)
      }
    }

    return api.post('/v1/doubao/create', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // 查询视频状态
  queryVideo: (id: string, channel?: string) =>
    api.get(`/v1/doubao/query?id=${encodeURIComponent(id)}${channel ? `&channel=${encodeURIComponent(channel)}` : ''}`),
}

// ============ 可灵 (Kling) API ============

export interface CreateKlingVideoParams {
  model: string
  prompt: string
  seconds?: string
  size?: string
  image?: string
  images?: string[]
  metadata?: {
    scene_type?: string
    motion_level?: string
    offpeak?: boolean
    last_frame_url?: string
    video_url?: string
    output_config?: {
      resolution?: string
      aspect_ratio?: string
    }
    file_infos?: Array<{
      file_url: string
      file_type?: string
    }>
  }
}

export const klingApi = {
  // 创建视频（支持本地文件上传 + URL 方式）
  createVideo: (
    params: CreateKlingVideoParams,
    imageFile?: File,
    lastFrameFile?: File,
    referenceFiles?: File[],
  ) => {
    const hasFiles = !!imageFile || !!lastFrameFile || (referenceFiles && referenceFiles.length > 0)

    if (hasFiles) {
      // 有文件时用 multipart/form-data
      const formData = new FormData()
      formData.append('model', params.model)
      formData.append('prompt', params.prompt)
      if (params.seconds) formData.append('seconds', String(params.seconds))
      if (params.size) formData.append('size', params.size)

      // 参考图：优先文件，其次 URL
      if (imageFile) {
        formData.append('image_file', imageFile)
      } else if (params.image) {
        formData.append('image', params.image)
      }

      // 尾帧文件
      if (lastFrameFile) {
        formData.append('last_frame_file', lastFrameFile)
      }

      // 多张参考图文件
      if (referenceFiles && referenceFiles.length > 0) {
        for (const file of referenceFiles) {
          formData.append('reference_files', file)
        }
      } else if (params.images && params.images.length > 0) {
        formData.append('images', JSON.stringify(params.images))
      }

      if (params.metadata) formData.append('metadata', JSON.stringify(params.metadata))

      return api.post('/v1/kling/create', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    }

    // 无文件时用 JSON
    const body: Record<string, any> = {
      model: params.model,
      prompt: params.prompt,
    }
    if (params.seconds) body.seconds = String(params.seconds)
    if (params.size) body.size = params.size
    if (params.image) body.image = params.image
    if (params.images && params.images.length > 0) body.images = params.images
    if (params.metadata) body.metadata = JSON.stringify(params.metadata)

    return api.post('/v1/kling/create', body)
  },

  // 查询视频状态
  queryVideo: (id: string) =>
    api.get(`/v1/kling/query?id=${encodeURIComponent(id)}`),
}

// ============ Gemini Image API ============

export interface CreateGeminiImageParams {
  model?: string
  prompt: string
  aspectRatio?: string
  imageSize?: string
  // Grok/GPT 图片模型参数
  size?: string
  n?: number
}

export interface GeminiImageResult {
  id: string
  status: 'processing' | 'completed' | 'failed' | 'not_found'
  prompt?: string
  model?: string
  aspectRatio?: string
  imageSize?: string
  images?: Array<{
    mimeType: string
    url?: string
    data?: string
  }>
  error?: string
  createdAt?: number
}

export const geminiImageApi = {
  // 创建图片（异步）
  createImage: (params: CreateGeminiImageParams, files?: File[]) => {
    // 有参考图时使用 FormData
    if (files && files.length > 0) {
      const formData = new FormData()
      formData.append('prompt', params.prompt)
      if (params.model) formData.append('model', params.model)
      if (params.aspectRatio) formData.append('aspectRatio', params.aspectRatio)
      if (params.imageSize) formData.append('imageSize', params.imageSize)
      if (params.size) formData.append('size', params.size)
      if (params.n) formData.append('n', String(params.n))
      
      for (const file of files) {
        formData.append('reference_images', file)
      }
      
      return api.post('/v1/image/create-with-ref', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
    }
    
    // 无参考图时直接发 JSON
    return api.post('/v1/image/create', params)
  },

  // 同步生成图片（等待结果）
  generateImage: (params: CreateGeminiImageParams, files?: File[]) => {
    // 有参考图时使用 FormData
    if (files && files.length > 0) {
      const formData = new FormData()
      formData.append('prompt', params.prompt)
      if (params.model) formData.append('model', params.model)
      if (params.aspectRatio) formData.append('aspectRatio', params.aspectRatio)
      if (params.imageSize) formData.append('imageSize', params.imageSize)
      if (params.size) formData.append('size', params.size)
      if (params.n) formData.append('n', String(params.n))
      
      for (const file of files) {
        formData.append('reference_images', file)
      }
      
      return api.post('/v1/image/generate-with-ref', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 180000,
      })
    }
    
    // 无参考图时直接发 JSON
    return api.post('/v1/image/generate', params, {
      timeout: 180000,
    })
  },

  // 查询图片状态
  queryImage: (id: string) =>
    api.get<GeminiImageResult>(`/v1/image/query?id=${encodeURIComponent(id)}`),
}

// ============ Config API (全局配置，管理员用) ============

export interface ServiceConfig {
  server: string
  key: string
  characterServer?: string
  characterKey?: string
  channel?: string
  xiaohuminiServer?: string
  xiaohuminiKey?: string
}

export interface EmailConfig {
  smtpServer: string
  smtpPort: number
  smtpSSL: boolean
  smtpAccount: string
  smtpToken: string
  smtpFrom: string
}

export interface AppConfig {
  port: number
  sora: ServiceConfig
  veo: ServiceConfig
  geminiImage: ServiceConfig
  grok: ServiceConfig
  grokImage: ServiceConfig
  doubao: ServiceConfig
  kling: ServiceConfig
  email: EmailConfig
  tutorialUrl: string
  qrcodeUrl: string
  footerContent: string
}

export const configApi = {
  // 获取配置（隐藏敏感信息）
  getConfig: () =>
    api.get<{ status: string; data: AppConfig }>('/v1/config'),

  // 获取完整配置（包含 API Key）
  getFullConfig: () =>
    api.get<{ status: string; data: AppConfig }>('/v1/config/full'),

  // 更新全部配置
  updateConfig: (config: Partial<AppConfig>) =>
    api.put<{ status: string; message: string; data: AppConfig }>('/v1/config', config),

  // 更新单个服务配置
  updateServiceConfig: (service: string, config: Record<string, any>) =>
    api.put<{ status: string; message: string; data: AppConfig }>(`/v1/config/${service}`, config),
}

// ============ User Config API (用户级配置) ============

export interface UserApiConfig {
  sora: ServiceConfig
  veo: ServiceConfig
  geminiImage: ServiceConfig
  grok: ServiceConfig
  grokImage: ServiceConfig
  doubao: ServiceConfig
  kling: ServiceConfig
}

export const userConfigApi = {
  // 获取当前用户配置（隐藏敏感信息）
  getConfig: () =>
    api.get<{ status: string; data: UserApiConfig }>('/v1/user-config'),

  // 获取当前用户完整配置（包含 API Key）
  getFullConfig: () =>
    api.get<{ status: string; data: UserApiConfig }>('/v1/user-config/full'),

  // 更新用户单个服务配置
  updateServiceConfig: (service: 'sora' | 'veo' | 'geminiImage' | 'grok' | 'grokImage' | 'doubao' | 'kling', config: Partial<ServiceConfig>) =>
    api.put<{ status: string; message: string; data: UserApiConfig }>(`/v1/user-config/${service}`, config),

  // 同步默认配置到所有服务
  syncDefault: (server: string, key: string, services?: string[]) =>
    api.put<{ status: string; message: string; data: UserApiConfig }>('/v1/user-config/sync-default', { server, key, services }),
}

// ============ Video Tasks API (视频任务记录) ============

export interface VideoTaskRecord {
  externalTaskId: string
  username: string
  platform: 'sora' | 'veo' | 'grok' | 'doubao' | 'kling'
  model: string
  prompt: string
  params?: Record<string, any>
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  video_url?: string
  thumbnail_url?: string
  error?: string
  createdAt: number
  updatedAt: number
}

export const videoTasksApi = {
  // 获取当前用户的任务列表
  getTasks: (params?: { platform?: string; status?: string; page?: number; limit?: number }) =>
    api.get<{ status: string; data: VideoTaskRecord[]; total: number; page: number; limit: number }>(
      '/v1/tasks',
      { params },
    ),

  // 删除某个任务
  deleteTask: (externalTaskId: string) =>
    api.delete<{ status: string; message: string }>(`/v1/tasks/${encodeURIComponent(externalTaskId)}`),

  // 清除所有已完成的任务
  clearCompleted: () =>
    api.delete<{ status: string; message: string; deletedCount: number }>('/v1/tasks/completed/clear'),
}

// ============ Admin API (管理员用户管理) ============

export interface AdminUser {
  _id: string
  username: string
  role: string
  created_at: number
  last_login: number
  videoTaskCount: number
  imageTaskCount: number
}

export interface AdminUserDetail {
  user: {
    _id: string
    username: string
    role: string
    created_at: number
    last_login: number
  }
  config: Record<string, any> | null
  videoTaskCount: number
  imageTaskCount: number
}

export interface AdminStats {
  totalUsers: number
  totalVideoTasks: number
  totalImageTasks: number
  videoByPlatform: Record<string, number>
  videoByStatus: Record<string, number>
  imageByStatus: Record<string, number>
}

export const adminApi = {
  // 获取用户列表（分页）
  getUsers: (params?: { page?: number; limit?: number; role?: string; keyword?: string }) =>
    api.get<{ status: string; data: AdminUser[]; total: number; page: number; limit: number }>(
      '/v1/admin/users',
      { params },
    ),

  // 获取单个用户详情（含配置）
  getUserDetail: (userId: string) =>
    api.get<{ status: string; data: AdminUserDetail }>(
      `/v1/admin/users/${encodeURIComponent(userId)}`,
    ),

  // 获取用户的视频任务（分页）
  getUserVideoTasks: (userId: string, params?: { page?: number; limit?: number }) =>
    api.get<{ status: string; data: any[]; total: number; page: number; limit: number }>(
      `/v1/admin/users/${encodeURIComponent(userId)}/video-tasks`,
      { params },
    ),

  // 获取用户的图片任务（分页）
  getUserImageTasks: (userId: string, params?: { page?: number; limit?: number }) =>
    api.get<{ status: string; data: any[]; total: number; page: number; limit: number }>(
      `/v1/admin/users/${encodeURIComponent(userId)}/image-tasks`,
      { params },
    ),

  // 获取用户完整配置（含 API Key，管理员专用）
  getUserFullConfig: (userId: string) =>
    api.get<{ status: string; data: { userId: string; username: string; config: UserApiConfig | null; updated_at: string | null } }>(
      `/v1/admin/users/${encodeURIComponent(userId)}/config`,
    ),

  // 获取平台统计概览
  getStats: () =>
    api.get<{ status: string; data: AdminStats }>('/v1/admin/stats'),

  // 管理员重置用户密码
  resetUserPassword: (userId: string, newPassword: string) =>
    api.put<{ status: string; message: string }>(
      `/v1/admin/users/${encodeURIComponent(userId)}/reset-password`,
      { newPassword },
    ),
}

// ============ Feedback API ============

export interface FeedbackItem {
  _id: string
  userId?: string
  username?: string
  title: string
  content: string
  type: 'bug' | 'feature' | 'question' | 'other'
  status: 'open' | 'replied' | 'resolved' | 'closed'
  adminReply: string | null
  repliedAt: number | null
  repliedBy?: string | null
  createdAt: number
  updatedAt: number
}

export interface FeedbackStats {
  total: number
  byStatus: Record<string, number>
  byType: Record<string, number>
}

export const feedbackApi = {
  // 用户提交反馈
  create: (data: { title: string; content: string; type?: string }) =>
    api.post<{ status: string; data: FeedbackItem }>('/v1/feedback', data),

  // 用户查看自己的反馈
  getMyFeedbacks: (params?: { page?: number; limit?: number }) =>
    api.get<{ status: string; data: FeedbackItem[]; total: number; page: number; limit: number }>(
      '/v1/feedback/my',
      { params },
    ),

  // 管理员获取所有反馈
  getAllFeedbacks: (params?: { page?: number; limit?: number; status?: string; type?: string; keyword?: string }) =>
    api.get<{ status: string; data: FeedbackItem[]; total: number; page: number; limit: number }>(
      '/v1/feedback/admin/all',
      { params },
    ),

  // 管理员回复反馈
  replyFeedback: (feedbackId: string, data: { reply: string; status?: string }) =>
    api.put<{ status: string; message: string }>(
      `/v1/feedback/admin/${encodeURIComponent(feedbackId)}/reply`,
      data,
    ),

  // 管理员更新反馈状态
  updateStatus: (feedbackId: string, status: string) =>
    api.put<{ status: string; message: string }>(
      `/v1/feedback/admin/${encodeURIComponent(feedbackId)}/status`,
      { status },
    ),

  // 管理员获取反馈统计
  getStats: () =>
    api.get<{ status: string; data: FeedbackStats }>('/v1/feedback/admin/stats'),
}

// ============ Announcement API ============

export interface AnnouncementItem {
  _id: string
  content: string
  publishDate: string
  type: string
  description: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export const announcementApi = {
  // 获取最新公告（公开）
  getLatest: (limit?: number) =>
    api.get<{ status: string; data: AnnouncementItem[] }>(
      '/v1/announcements/latest',
      { params: { limit } },
    ),

  // 管理员获取公告列表
  getList: (params?: { page?: number; limit?: number }) =>
    api.get<{ status: string; data: AnnouncementItem[]; total: number; page: number; limit: number }>(
      '/v1/announcements',
      { params },
    ),

  // 管理员创建公告
  create: (data: { content: string; publishDate?: string; type?: string; description?: string }) =>
    api.post<{ status: string; data: AnnouncementItem }>(
      '/v1/announcements',
      data,
    ),

  // 管理员更新公告
  update: (id: string, data: { content?: string; publishDate?: string; type?: string; description?: string }) =>
    api.put<{ status: string; message: string }>(
      `/v1/announcements/${encodeURIComponent(id)}`,
      data,
    ),

  // 管理员删除公告
  delete: (id: string) =>
    api.delete<{ status: string; message: string }>(
      `/v1/announcements/${encodeURIComponent(id)}`,
    ),

  // 管理员批量删除公告
  deleteMany: (ids: string[]) =>
    api.delete<{ status: string; message: string }>(
      '/v1/announcements',
      { data: { ids } },
    ),
}

// ============ Model Catalog API ============

export interface ModelCatalogItem {
  _id: string
  platform: string
  category: string
  name: string
  value: string
  sort: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

/** 按 category 分组的模型列表 { category: [{ name, value }] } */
export type ModelCatalogGrouped = Record<string, { name: string; value: string }[]>

/** 所有平台的模型 { platform: { category: [{ name, value }] } } */
export type AllPlatformModels = Record<string, ModelCatalogGrouped>

export const modelCatalogApi = {
  // 获取指定平台的已启用模型（分组，前端下拉菜单用）
  getByPlatform: (platform: string) =>
    api.get<{ status: string; data: ModelCatalogGrouped }>(
      `/v1/model-catalog/platform/${encodeURIComponent(platform)}`,
    ),

  // 获取所有平台的已启用模型（一次性加载）
  getAllPlatforms: () =>
    api.get<{ status: string; data: AllPlatformModels }>(
      '/v1/model-catalog/all-platforms',
    ),

  // 管理员获取全部模型（含禁用）
  getAll: (platform?: string) =>
    api.get<{ status: string; data: ModelCatalogItem[] }>(
      '/v1/model-catalog',
      { params: { platform } },
    ),

  // 管理员创建模型
  create: (data: { platform: string; category: string; name: string; value: string; sort?: number; enabled?: boolean }) =>
    api.post<{ status: string; data: ModelCatalogItem }>(
      '/v1/model-catalog',
      data,
    ),

  // 管理员更新模型
  update: (id: string, data: Partial<{ platform: string; category: string; name: string; value: string; sort: number; enabled: boolean }>) =>
    api.put<{ status: string; data: ModelCatalogItem }>(
      `/v1/model-catalog/${encodeURIComponent(id)}`,
      data,
    ),

  // 管理员删除模型
  delete: (id: string) =>
    api.delete<{ status: string; message: string }>(
      `/v1/model-catalog/${encodeURIComponent(id)}`,
    ),

  // 管理员切换启用/禁用
  toggleEnabled: (id: string) =>
    api.put<{ status: string; data: ModelCatalogItem }>(
      `/v1/model-catalog/${encodeURIComponent(id)}/toggle`,
    ),

  // 管理员初始化默认模型数据
  seedDefaults: () =>
    api.post<{ status: string; data: { inserted: number } }>(
      '/v1/model-catalog/seed',
    ),
}

export default api

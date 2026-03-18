import { createRouter, createWebHistory } from 'vue-router'

/**
 * 解析 JWT 的 payload，检查是否过期
 * 正确处理 base64url 编码和 UTF-8 中文字符
 */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    // base64url → 标准 base64
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) base64 += '='
    // 解码 base64 → UTF-8 字节 → 字符串
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    const jsonStr = new TextDecoder().decode(bytes)
    const payload = JSON.parse(jsonStr)
    if (!payload.exp) return false
    // exp 是秒级时间戳，留 60 秒缓冲
    return Date.now() >= (payload.exp - 60) * 1000
  } catch {
    return true
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/image',
      name: 'image',
      component: () => import('@/views/ImageView.vue')
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('@/views/TasksView.vue')
    },
    {
      path: '/characters',
      name: 'characters',
      component: () => import('@/views/CharactersView.vue')
    },
    {
      path: '/query',
      name: 'query',
      component: () => import('@/views/QueryView.vue')
    },
    {
      path: '/config',
      name: 'config',
      component: () => import('@/views/ConfigView.vue')
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/feedback',
      name: 'feedback',
      component: () => import('@/views/FeedbackView.vue'),
    },
    {
      path: '/admin/feedback',
      name: 'admin-feedback',
      component: () => import('@/views/AdminFeedbackView.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin/announcements',
      name: 'admin-announcements',
      component: () => import('@/views/AdminAnnouncementView.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin/models',
      name: 'admin-models',
      component: () => import('@/views/AdminModelCatalogView.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin/prompt-templates',
      name: 'admin-prompt-templates',
      component: () => import('@/views/AdminPromptTemplateView.vue'),
      meta: { requiresAdmin: true },
    }
  ]
})

// 路由守卫：未登录跳转登录页
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('auth_token')

  // 访问登录页
  if (to.name === 'login') {
    // 已登录且 token 未过期则跳转首页
    if (token && !isTokenExpired(token)) {
      next({ name: 'home' })
    } else {
      // token 过期或不存在，清理残留
      if (token) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_userId')
        localStorage.removeItem('auth_username')
        localStorage.removeItem('auth_role')
      }
      next()
    }
    return
  }

  // 访问其他页面，检查是否登录
  if (!token || isTokenExpired(token)) {
    // token 不存在或已过期，清理并跳转登录
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_userId')
    localStorage.removeItem('auth_username')
    localStorage.removeItem('auth_role')
    next({ name: 'login' })
    return
  }

  next()
})

export default router

<template>
  <div class="app">
    <header v-if="showHeader" class="header">
      <div class="header-content">
        <div class="logo">🎬 AI 创作中心</div>
        <nav class="nav">
          <router-link to="/" class="nav-link">🎬 视频生成</router-link>
          <router-link to="/image" class="nav-link">🎨 图片创作</router-link>

          <!-- 任务中心下拉 -->
          <div class="nav-dropdown">
            <span class="nav-link nav-dropdown-trigger">📋 任务中心 <span class="drop-arrow">▾</span></span>
            <div class="nav-dropdown-menu">
              <router-link to="/tasks" class="dropdown-item">📄 任务列表</router-link>
              <router-link to="/query" class="dropdown-item">🔍 任务查询</router-link>
              <router-link to="/characters" class="dropdown-item">👤 角色管理</router-link>
            </div>
          </div>

          <router-link to="/feedback" class="nav-link">📮 问题反馈</router-link>
          <router-link to="/config" class="nav-link">⚙️ 配置</router-link>
          <a v-if="tutorialUrl" :href="tutorialUrl" target="_blank" rel="noopener noreferrer" class="nav-link tutorial-link">📖 教程</a>

          <!-- 管理后台下拉（仅管理员） -->
          <div v-if="authStore.isAdmin" class="nav-dropdown">
            <span class="nav-link nav-dropdown-trigger admin-link">🛠️ 管理后台 <span class="drop-arrow">▾</span></span>
            <div class="nav-dropdown-menu">
              <router-link to="/admin" class="dropdown-item">👥 用户管理</router-link>
              <router-link to="/admin/feedback" class="dropdown-item">📝 反馈管理</router-link>
              <router-link to="/admin/announcements" class="dropdown-item">📢 公告管理</router-link>
            </div>
          </div>
        </nav>

        <!-- 公告铃铛 -->
        <div class="bell-area" @click.stop="toggleAnnouncementPanel">
          <div class="bell-icon">
            🔔
            <span v-if="unreadCount > 0" class="bell-badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
          </div>
        </div>

        <div class="user-area">
          <!-- 用户头像按钮 -->
          <div class="avatar-wrapper" @click.stop="showUserPanel = !showUserPanel">
            <div class="avatar">{{ avatarChar }}</div>
            <span class="avatar-name">{{ authStore.username }}</span>
            <span class="avatar-arrow" :class="{ open: showUserPanel }">▾</span>
          </div>

          <!-- 用户信息面板 -->
          <div v-if="showUserPanel" class="user-panel" @click.stop>
            <!-- 用户信息 -->
            <div class="panel-section user-info-section">
              <div class="panel-avatar">{{ avatarChar }}</div>
              <div class="panel-user-details">
                <div class="panel-username">{{ authStore.username }}</div>
                <div class="panel-role">{{ authStore.isAdmin ? '管理员' : '普通用户' }}</div>
              </div>
            </div>
            <div class="panel-divider"></div>
            <div class="panel-section">
              <div class="panel-label">用户 ID</div>
              <div class="panel-value panel-id" @click="copyUserId">
                {{ authStore.userId }}
                <span class="copy-icon">{{ copySuccess ? '✅' : '📋' }}</span>
              </div>
            </div>
            <div class="panel-divider"></div>

            <!-- 修改密码区域 -->
            <div class="panel-section">
              <button v-if="!showPwdForm" class="panel-btn change-pwd-btn" @click="showPwdForm = true">
                🔑 修改密码
              </button>
              <div v-else class="pwd-form">
                <div class="pwd-field">
                  <input v-model="oldPassword" type="password" placeholder="当前密码" class="pwd-input" />
                </div>
                <div class="pwd-field">
                  <input v-model="newPassword" type="password" placeholder="新密码（至少6位）" class="pwd-input" />
                </div>
                <div class="pwd-field">
                  <input v-model="confirmNewPassword" type="password" placeholder="确认新密码" class="pwd-input" />
                </div>
                <div v-if="pwdError" class="pwd-error">❌ {{ pwdError }}</div>
                <div v-if="pwdSuccess" class="pwd-success">✅ {{ pwdSuccess }}</div>
                <div class="pwd-actions">
                  <button class="panel-btn cancel-btn" @click="resetPwdForm">取消</button>
                  <button class="panel-btn confirm-btn" :disabled="pwdLoading" @click="handleChangePassword">
                    {{ pwdLoading ? '提交中...' : '确认修改' }}
                  </button>
                </div>
              </div>
            </div>
            <div class="panel-divider"></div>

            <!-- 退出登录 -->
            <div class="panel-section">
              <button class="panel-btn logout-panel-btn" @click="handleLogout">🚪 退出登录</button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- 公告弹出面板 -->
    <div v-if="showAnnouncementPanel && latestAnnouncements.length > 0" class="ann-panel-overlay" @click.self="closeAnnouncementPanel">
      <div class="ann-panel" @click.stop>
        <div class="ann-panel-header">
          <h3>系统公告</h3>
          <div class="ann-panel-tabs">
            <button class="ann-tab" :class="{ active: annTab === 'announcement' }" @click="annTab = 'announcement'">📢 系统公告</button>
          </div>
          <button class="ann-panel-close" @click="closeAnnouncementPanel">&times;</button>
        </div>
        <div class="ann-panel-body">
          <div v-if="latestAnnouncements.length === 0" class="ann-empty">暂无公告</div>
          <div v-else class="ann-list">
            <div v-for="a in latestAnnouncements" :key="a._id" class="ann-list-item">
              <div class="ann-dot"></div>
              <div class="ann-item-body">
                <div class="ann-item-content">{{ a.content }}</div>
                <div class="ann-item-time">{{ relativeTime(a.publishDate) }} {{ formatDate(a.publishDate) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <main class="container">
      <router-view />
    </main>

    <!-- 页脚 -->
    <footer v-if="showHeader && footerContent" class="app-footer">
      <div class="footer-content">{{ footerContent }}</div>
    </footer>

    <!-- 悬浮二维码 -->
    <div v-if="showHeader && qrcodeUrl" class="floating-qrcode">
      <div class="qrcode-trigger">
        <img :src="qrcodeUrl" alt="沟通群二维码" class="qrcode-thumb" />
        <span class="qrcode-label">交流群</span>
      </div>
      <div class="qrcode-popup">
        <img :src="qrcodeUrl" alt="沟通群二维码" class="qrcode-full" />
        <p class="qrcode-tip">扫码加入项目沟通群</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { configApi, announcementApi, type AnnouncementItem } from '@/api'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const showHeader = computed(() => route.name !== 'login')
const avatarChar = computed(() => (authStore.username || '?').charAt(0).toUpperCase())

// 使用教程链接
const tutorialUrl = ref('')

// 二维码图片 URL
const qrcodeUrl = ref('')

// 页脚内容
const footerContent = ref('')

// 公告
const latestAnnouncements = ref<AnnouncementItem[]>([])
const showAnnouncementPanel = ref(false)
const annTab = ref('announcement')

/** 获取已读公告 ID 列表 */
const getReadIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem('read_announcement_ids') || '[]')
  } catch { return [] }
}

/** 标记公告为已读 */
const markAllRead = () => {
  const ids = latestAnnouncements.value.map(a => a._id)
  const existing = getReadIds()
  const merged = Array.from(new Set([...existing, ...ids]))
  // 最多保留 200 条已读记录，避免 localStorage 膨胀
  localStorage.setItem('read_announcement_ids', JSON.stringify(merged.slice(-200)))
}

const unreadCount = computed(() => {
  const readIds = getReadIds()
  return latestAnnouncements.value.filter(a => !readIds.includes(a._id)).length
})

const loadAnnouncements = async () => {
  try {
    const res = await announcementApi.getLatest(10)
    latestAnnouncements.value = res.data.data || []
    // 如果有未读公告，自动弹出
    if (unreadCount.value > 0) {
      showAnnouncementPanel.value = true
    }
  } catch {}
}

const toggleAnnouncementPanel = () => {
  showAnnouncementPanel.value = !showAnnouncementPanel.value
}

const closeAnnouncementPanel = () => {
  markAllRead()
  showAnnouncementPanel.value = false
}

/** 相对时间 */
const relativeTime = (dateStr: string) => {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  return `${months}个月前`
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const loadTutorialUrl = async () => {
  try {
    const res = await configApi.getConfig()
    tutorialUrl.value = res.data.data.tutorialUrl || ''
    qrcodeUrl.value = res.data.data.qrcodeUrl || ''
    footerContent.value = res.data.data.footerContent || ''
  } catch {}
}

// 面板状态
const showUserPanel = ref(false)
const copySuccess = ref(false)

// 修改密码
const showPwdForm = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')
const pwdError = ref('')
const pwdSuccess = ref('')
const pwdLoading = ref(false)

const resetPwdForm = () => {
  showPwdForm.value = false
  oldPassword.value = ''
  newPassword.value = ''
  confirmNewPassword.value = ''
  pwdError.value = ''
  pwdSuccess.value = ''
}

const copyUserId = async () => {
  if (!authStore.userId) return
  try {
    await navigator.clipboard.writeText(authStore.userId)
    copySuccess.value = true
    setTimeout(() => { copySuccess.value = false }, 1500)
  } catch {}
}

const handleChangePassword = async () => {
  pwdError.value = ''
  pwdSuccess.value = ''

  if (!oldPassword.value) { pwdError.value = '请输入当前密码'; return }
  if (!newPassword.value || newPassword.value.length < 6) { pwdError.value = '新密码至少 6 个字符'; return }
  if (newPassword.value !== confirmNewPassword.value) { pwdError.value = '两次输入的新密码不一致'; return }

  pwdLoading.value = true
  try {
    await authStore.changePassword(oldPassword.value, newPassword.value)
    pwdSuccess.value = '密码修改成功，即将重新登录...'
    setTimeout(() => {
      authStore.logout()
      router.push('/login')
    }, 1500)
  } catch (err: any) {
    pwdError.value = err.response?.data?.message || err.message || '修改失败'
  } finally {
    pwdLoading.value = false
  }
}

const handleLogout = () => {
  showUserPanel.value = false
  authStore.logout()
  router.push('/login')
}

// 点击页面其他区域关闭面板
const closePanel = () => {
  showUserPanel.value = false
  resetPwdForm()
}
onMounted(() => {
  document.addEventListener('click', closePanel)
  loadTutorialUrl()
  loadAnnouncements()
})
onUnmounted(() => document.removeEventListener('click', closePanel))
</script>

<style scoped>
/* ===== 用户区域 ===== */
.user-area {
  position: relative;
  margin-left: auto;
}

.avatar-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 8px;
  transition: background 0.2s;
}
.avatar-wrapper:hover {
  background: rgba(255, 255, 255, 0.1);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.avatar-name {
  color: #ddd;
  font-size: 14px;
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-arrow {
  color: #999;
  font-size: 12px;
  transition: transform 0.2s;
}
.avatar-arrow.open {
  transform: rotate(180deg);
}

/* ===== 用户面板 ===== */
.user-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 300px;
  background: #1e1e2e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  overflow: hidden;
}

.panel-section {
  padding: 14px 16px;
}

.panel-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

/* 用户信息头部 */
.user-info-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
}

.panel-user-details {
  flex: 1;
  min-width: 0;
}

.panel-username {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-role {
  color: #888;
  font-size: 12px;
  margin-top: 2px;
}

/* 用户 ID */
.panel-label {
  color: #888;
  font-size: 12px;
  margin-bottom: 4px;
}

.panel-value {
  color: #ccc;
  font-size: 13px;
  word-break: break-all;
}

.panel-id {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  transition: background 0.2s;
}
.panel-id:hover {
  background: rgba(255, 255, 255, 0.1);
}

.copy-icon {
  font-size: 14px;
  margin-left: auto;
  flex-shrink: 0;
}

/* 按钮 */
.panel-btn {
  width: 100%;
  padding: 8px 0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  text-align: center;
}

.change-pwd-btn {
  background: rgba(102, 126, 234, 0.15);
  color: #8fa4f4;
}
.change-pwd-btn:hover {
  background: rgba(102, 126, 234, 0.25);
}

.logout-panel-btn {
  background: rgba(255, 80, 80, 0.1);
  color: #f87171;
}
.logout-panel-btn:hover {
  background: rgba(255, 80, 80, 0.2);
}

/* 修改密码表单 */
.pwd-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pwd-field {}

.pwd-input {
  width: 100%;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #ddd;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.pwd-input:focus {
  border-color: rgba(102, 126, 234, 0.6);
}
.pwd-input::placeholder {
  color: #666;
}

.pwd-error {
  color: #f87171;
  font-size: 12px;
}

.pwd-success {
  color: #4ade80;
  font-size: 12px;
}

.pwd-actions {
  display: flex;
  gap: 8px;
}

.cancel-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  color: #aaa;
}
.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.confirm-btn {
  flex: 1;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}
.confirm-btn:hover {
  opacity: 0.9;
}
.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== 页脚 ===== */
.app-footer {
  padding: 16px 24px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: auto;
}

.footer-content {
  color: #888;
  font-size: 13px;
  line-height: 1.6;
  max-width: 800px;
  margin: 0 auto;
  white-space: pre-line;
}

/* ===== 悬浮二维码 ===== */
.floating-qrcode {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999;
}

.qrcode-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 8px;
  background: rgba(30, 30, 46, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  transition: all 0.3s;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.qrcode-trigger:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  border-color: rgba(102, 126, 234, 0.5);
}

.qrcode-thumb {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
}

.qrcode-label {
  color: #aaa;
  font-size: 10px;
  white-space: nowrap;
}

.qrcode-popup {
  position: absolute;
  bottom: calc(100% + 12px);
  right: 0;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  opacity: 0;
  visibility: hidden;
  transform: translateY(8px) scale(0.95);
  transition: all 0.25s ease;
  pointer-events: none;
}

.floating-qrcode:hover .qrcode-popup {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.qrcode-popup::after {
  content: '';
  position: absolute;
  bottom: -8px;
  right: 20px;
  width: 16px;
  height: 16px;
  background: #fff;
  transform: rotate(45deg);
  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.1);
}

.qrcode-full {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  object-fit: contain;
  display: block;
}

.qrcode-tip {
  margin: 10px 0 0;
  text-align: center;
  color: #666;
  font-size: 13px;
}

/* ===== 铃铛图标 ===== */
.bell-area {
  position: relative;
  cursor: pointer;
  padding: 6px;
  margin-left: 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.bell-area:hover {
  background: rgba(255, 255, 255, 0.1);
}

.bell-icon {
  font-size: 20px;
  position: relative;
  line-height: 1;
}

.bell-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  padding: 0 4px;
}

/* ===== 公告面板 ===== */
.ann-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
}

.ann-panel {
  width: 440px;
  max-width: 90vw;
  max-height: 80vh;
  margin-top: 60px;
  margin-right: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: annSlideIn 0.2s ease;
}

@keyframes annSlideIn {
  from { opacity: 0; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
}

.ann-panel-header {
  display: flex;
  align-items: center;
  padding: 16px 20px 0;
  gap: 12px;
}

.ann-panel-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  white-space: nowrap;
}

.ann-panel-tabs {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.ann-tab {
  background: none;
  border: none;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 16px;
  transition: all 0.2s;
}

.ann-tab.active {
  background: #f0f0ff;
  color: #5b6abf;
  font-weight: 500;
}

.ann-panel-close {
  background: none;
  border: none;
  color: #999;
  font-size: 22px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}

.ann-panel-close:hover {
  color: #333;
}

.ann-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px 20px;
}

.ann-empty {
  text-align: center;
  color: #999;
  padding: 40px 0;
  font-size: 14px;
}

.ann-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ann-list-item {
  display: flex;
  gap: 14px;
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f0;
}

.ann-list-item:last-child {
  border-bottom: none;
}

.ann-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5b6abf;
  flex-shrink: 0;
  margin-top: 6px;
}

.ann-item-body {
  flex: 1;
  min-width: 0;
}

.ann-item-content {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
  word-break: break-all;
}

.ann-item-time {
  font-size: 12px;
  color: #aaa;
  margin-top: 6px;
}
</style>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { adminApi, type AdminUser, type AdminStats } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

// 非管理员重定向
if (!authStore.isAdmin) {
  router.replace('/')
}

// ============ 状态 ============
const loading = ref(false)
const users = ref<AdminUser[]>([])
const stats = ref<AdminStats | null>(null)
const totalUsers = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')
const filterRole = ref('')

// 展开的用户详情
const expandedUserId = ref<string | null>(null)
const expandedTab = ref<'config' | 'video' | 'image'>('config')
const detailLoading = ref(false)
const userDetail = ref<any>(null)
const userVideoTasks = ref<any[]>([])
const userImageTasks = ref<any[]>([])
const videoTotal = ref(0)
const imageTotal = ref(0)
const videoPage = ref(1)
const imagePage = ref(1)

// 重置密码
const resetPasswordModal = ref(false)
const resetPasswordUser = ref<AdminUser | null>(null)
const resetNewPassword = ref('')
const resetPasswordLoading = ref(false)
const resetPasswordMsg = ref('')
const resetPasswordError = ref('')

// 查看完整配置
const fullConfigModal = ref(false)
const fullConfigLoading = ref(false)
const fullConfigData = ref<any>(null)
const fullConfigUsername = ref('')

// ============ 格式化 ============
const formatTime = (ts: number) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}

const roleText = (role: string) => role === 'admin' ? '管理员' : '普通用户'

const statusText: Record<string, string> = {
  queued: '排队中',
  processing: '生成中',
  completed: '已完成',
  failed: '失败',
}

const totalPages = computed(() => Math.ceil(totalUsers.value / pageSize.value) || 1)

// ============ 加载数据 ============
const loadStats = async () => {
  try {
    const res = await adminApi.getStats()
    stats.value = res.data.data
  } catch (e: any) {
    console.error('加载统计失败:', e)
  }
}

const loadUsers = async () => {
  loading.value = true
  try {
    const res = await adminApi.getUsers({
      page: currentPage.value,
      limit: pageSize.value,
      role: filterRole.value || undefined,
      keyword: searchKeyword.value || undefined,
    })
    users.value = res.data.data
    totalUsers.value = res.data.total
  } catch (e: any) {
    console.error('加载用户列表失败:', e)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadUsers()
}

const changePage = (page: number) => {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadUsers()
}

// ============ 展开用户详情 ============
const toggleExpand = async (userId: string) => {
  if (expandedUserId.value === userId) {
    expandedUserId.value = null
    return
  }
  expandedUserId.value = userId
  expandedTab.value = 'config'
  videoPage.value = 1
  imagePage.value = 1
  await loadUserDetail(userId)
}

const loadUserDetail = async (userId: string) => {
  detailLoading.value = true
  try {
    const res = await adminApi.getUserDetail(userId)
    userDetail.value = res.data.data
  } catch (e: any) {
    console.error('加载用户详情失败:', e)
  } finally {
    detailLoading.value = false
  }
}

const switchTab = async (tab: 'config' | 'video' | 'image') => {
  expandedTab.value = tab
  if (tab === 'video' && userVideoTasks.value.length === 0) {
    await loadVideoTasks()
  }
  if (tab === 'image' && userImageTasks.value.length === 0) {
    await loadImageTasks()
  }
}

const loadVideoTasks = async () => {
  if (!expandedUserId.value) return
  detailLoading.value = true
  try {
    const res = await adminApi.getUserVideoTasks(expandedUserId.value, {
      page: videoPage.value,
      limit: 10,
    })
    userVideoTasks.value = res.data.data
    videoTotal.value = res.data.total
  } catch (e: any) {
    console.error('加载视频任务失败:', e)
  } finally {
    detailLoading.value = false
  }
}

const loadImageTasks = async () => {
  if (!expandedUserId.value) return
  detailLoading.value = true
  try {
    const res = await adminApi.getUserImageTasks(expandedUserId.value, {
      page: imagePage.value,
      limit: 10,
    })
    userImageTasks.value = res.data.data
    imageTotal.value = res.data.total
  } catch (e: any) {
    console.error('加载图片任务失败:', e)
  } finally {
    detailLoading.value = false
  }
}

const changeVideoPage = (page: number) => {
  videoPage.value = page
  loadVideoTasks()
}

const changeImagePage = (page: number) => {
  imagePage.value = page
  loadImageTasks()
}

// ============ 初始化 ============
onMounted(() => {
  loadStats()
  loadUsers()
})

// ============ 重置密码 ============
const openResetPassword = (user: AdminUser) => {
  resetPasswordUser.value = user
  resetNewPassword.value = ''
  resetPasswordMsg.value = ''
  resetPasswordError.value = ''
  resetPasswordModal.value = true
}

const closeResetPassword = () => {
  resetPasswordModal.value = false
  resetPasswordUser.value = null
}

const submitResetPassword = async () => {
  if (!resetPasswordUser.value) return
  if (resetNewPassword.value.length < 6) {
    resetPasswordError.value = '密码至少 6 个字符'
    return
  }
  resetPasswordLoading.value = true
  resetPasswordError.value = ''
  resetPasswordMsg.value = ''
  try {
    const res = await adminApi.resetUserPassword(resetPasswordUser.value._id, resetNewPassword.value)
    resetPasswordMsg.value = res.data.message || '密码重置成功'
    resetNewPassword.value = ''
  } catch (e: any) {
    resetPasswordError.value = e.response?.data?.message || '重置失败'
  } finally {
    resetPasswordLoading.value = false
  }
}

// ============ 查看完整配置 ============
const openFullConfig = async (userId: string) => {
  fullConfigModal.value = true
  fullConfigLoading.value = true
  fullConfigData.value = null
  fullConfigUsername.value = ''
  try {
    const res = await adminApi.getUserFullConfig(userId)
    fullConfigData.value = res.data.data?.config || null
    fullConfigUsername.value = res.data.data?.username || userId
  } catch (e: any) {
    console.error('加载用户完整配置失败:', e)
  } finally {
    fullConfigLoading.value = false
  }
}

const closeFullConfig = () => {
  fullConfigModal.value = false
  fullConfigData.value = null
}

const serviceLabels: Record<string, string> = {
  sora: 'Sora',
  veo: 'VEO',
  geminiImage: 'Gemini Image',
  grok: 'Grok',
  grokImage: 'Grok Image',
  doubao: '豆包 (Doubao)',
  kling: '可灵 (Kling)',
}

const fieldLabels: Record<string, string> = {
  server: 'API 地址',
  key: 'API 密钥',
  characterServer: '角色 API 地址',
  characterKey: '角色 API 密钥',
}
</script>

<template>
  <div class="admin">
    <!-- 统计概览 -->
    <div class="stats-cards" v-if="stats">
      <div class="stat-card">
        <div class="stat-number">{{ stats.totalUsers }}</div>
        <div class="stat-label">总用户数</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.totalVideoTasks }}</div>
        <div class="stat-label">视频任务总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.totalImageTasks }}</div>
        <div class="stat-label">图片任务总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.videoByStatus?.completed || 0 }}</div>
        <div class="stat-label">视频已完成</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.imageByStatus?.completed || 0 }}</div>
        <div class="stat-label">图片已完成</div>
      </div>
    </div>

    <!-- 平台分布 -->
    <div class="platform-stats" v-if="stats && stats.videoByPlatform">
      <h3>视频平台分布</h3>
      <div class="platform-tags">
        <span v-for="(count, platform) in stats.videoByPlatform" :key="platform" class="platform-tag">
          {{ platform }}: {{ count }}
        </span>
      </div>
    </div>

    <!-- 用户列表 -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">👥 用户管理</h2>
        <div class="card-header-actions">
          <input
            v-model="searchKeyword"
            placeholder="搜索用户名..."
            class="search-input"
            @keyup.enter="handleSearch"
          />
          <select v-model="filterRole" @change="handleSearch" class="role-filter">
            <option value="">全部角色</option>
            <option value="admin">管理员</option>
            <option value="user">普通用户</option>
          </select>
          <button class="btn btn-secondary" @click="loadUsers" :disabled="loading">
            {{ loading ? '加载中...' : '刷新' }}
          </button>
        </div>
      </div>

      <!-- 表格 -->
      <div class="table-wrapper">
        <table class="user-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>角色</th>
              <th>注册时间</th>
              <th>最后登录</th>
              <th>视频任务</th>
              <th>图片任务</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="user in users" :key="user._id">
              <tr :class="{ 'row-expanded': expandedUserId === user._id }">
                <td class="username-cell">{{ user.username }}</td>
                <td><span class="role-badge" :class="user.role">{{ roleText(user.role) }}</span></td>
                <td>{{ formatTime(user.created_at) }}</td>
                <td>{{ formatTime(user.last_login) }}</td>
                <td>{{ user.videoTaskCount }}</td>
                <td>{{ user.imageTaskCount }}</td>
                <td>
                  <div class="action-btns">
                    <button class="btn btn-small" @click="toggleExpand(user._id)">
                      {{ expandedUserId === user._id ? '收起' : '查看详情' }}
                    </button>
                    <button
                      class="btn btn-small btn-warn"
                      @click="openResetPassword(user)"
                      v-if="user._id !== authStore.userId"
                    >
                      重置密码
                    </button>
                  </div>
                </td>
              </tr>
              <!-- 内联用户详情行 -->
              <tr v-if="expandedUserId === user._id" class="detail-inline-row">
                <td colspan="7" class="detail-inline-cell">
                  <div class="detail-panel">
                    <div class="detail-tabs">
                      <button
                        class="tab-btn"
                        :class="{ active: expandedTab === 'config' }"
                        @click="switchTab('config')"
                      >配置信息</button>
                      <button
                        class="tab-btn"
                        :class="{ active: expandedTab === 'video' }"
                        @click="switchTab('video')"
                      >视频任务</button>
                      <button
                        class="tab-btn"
                        :class="{ active: expandedTab === 'image' }"
                        @click="switchTab('image')"
                      >图片任务</button>
                    </div>

                    <div v-if="detailLoading" class="detail-loading">加载中...</div>

                    <!-- 配置信息 -->
                    <div v-else-if="expandedTab === 'config'" class="detail-content">
                      <div v-if="userDetail">
                        <div class="user-basic-info">
                          <p><strong>用户ID：</strong>{{ userDetail.user._id }}</p>
                          <p><strong>用户名：</strong>{{ userDetail.user.username }}</p>
                          <p><strong>角色：</strong>{{ roleText(userDetail.user.role) }}</p>
                          <p><strong>视频任务数：</strong>{{ userDetail.videoTaskCount }}</p>
                          <p><strong>图片任务数：</strong>{{ userDetail.imageTaskCount }}</p>
                        </div>
                        <div v-if="userDetail.config" class="config-section">
                          <div class="config-section-header">
                            <h4>API 配置</h4>
                            <button class="btn btn-small" @click="openFullConfig(expandedUserId!)">
                              🔑 查看完整配置
                            </button>
                          </div>
                          <div v-for="(cfg, service) in userDetail.config" :key="service" class="config-item">
                            <div class="config-service">{{ service }}</div>
                            <div class="config-detail">
                              <span class="config-label">Server:</span>
                              <span class="config-value">{{ cfg.server || '-' }}</span>
                            </div>
                            <div class="config-detail">
                              <span class="config-label">Key:</span>
                              <span class="config-value mono">{{ cfg.key || '-' }}</span>
                            </div>
                          </div>
                        </div>
                        <div v-else class="empty">该用户未配置 API</div>
                      </div>
                    </div>

                    <!-- 视频任务 -->
                    <div v-else-if="expandedTab === 'video'" class="detail-content">
                      <div v-if="userVideoTasks.length === 0" class="empty">暂无视频任务</div>
                      <div v-else class="task-list">
                        <div v-for="task in userVideoTasks" :key="task.externalTaskId || task._id" class="task-card">
                          <div class="task-header">
                            <span class="platform-badge">{{ task.platform }}</span>
                            <span class="status-badge" :class="task.status">{{ statusText[task.status] || task.status }}</span>
                            <span class="task-time">{{ formatTime(task.createdAt) }}</span>
                          </div>
                          <div class="task-prompt">{{ task.prompt }}</div>
                          <div class="task-meta">
                            <span>模型: {{ task.model }}</span>
                            <span v-if="task.video_url">
                              <a :href="task.video_url" target="_blank" class="video-link">查看视频</a>
                            </span>
                          </div>
                        </div>
                        <!-- 视频分页 -->
                        <div class="pagination" v-if="videoTotal > 10">
                          <button class="btn btn-small" :disabled="videoPage <= 1" @click="changeVideoPage(videoPage - 1)">上一页</button>
                          <span class="page-info">{{ videoPage }} / {{ Math.ceil(videoTotal / 10) }}</span>
                          <button class="btn btn-small" :disabled="videoPage >= Math.ceil(videoTotal / 10)" @click="changeVideoPage(videoPage + 1)">下一页</button>
                        </div>
                      </div>
                    </div>

                    <!-- 图片任务 -->
                    <div v-else-if="expandedTab === 'image'" class="detail-content">
                      <div v-if="userImageTasks.length === 0" class="empty">暂无图片任务</div>
                      <div v-else class="task-list">
                        <div v-for="task in userImageTasks" :key="task.taskId || task._id" class="task-card">
                          <div class="task-header">
                            <span class="platform-badge">{{ task.model || 'gemini' }}</span>
                            <span class="status-badge" :class="task.status">{{ statusText[task.status] || task.status }}</span>
                            <span class="task-time">{{ formatTime(task.createdAt) }}</span>
                          </div>
                          <div class="task-prompt">{{ task.prompt }}</div>
                          <div class="task-meta">
                            <span v-if="task.aspectRatio">比例: {{ task.aspectRatio }}</span>
                            <span v-if="task.images && task.images.length">图片数: {{ task.images.length }}</span>
                          </div>
                          <!-- 图片预览 -->
                          <div v-if="task.images && task.images.length > 0" class="image-preview">
                            <img
                              v-for="(img, idx) in task.images.slice(0, 4)"
                              :key="idx"
                              :src="img.url || `data:${img.mimeType};base64,${img.data}`"
                              class="preview-thumb"
                              alt="预览"
                            />
                          </div>
                        </div>
                        <!-- 图片分页 -->
                        <div class="pagination" v-if="imageTotal > 10">
                          <button class="btn btn-small" :disabled="imagePage <= 1" @click="changeImagePage(imagePage - 1)">上一页</button>
                          <span class="page-info">{{ imagePage }} / {{ Math.ceil(imageTotal / 10) }}</span>
                          <button class="btn btn-small" :disabled="imagePage >= Math.ceil(imageTotal / 10)" @click="changeImagePage(imagePage + 1)">下一页</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="!loading && users.length === 0" class="empty">暂无用户数据</div>

      <!-- 分页 -->
      <div class="pagination" v-if="totalPages > 1">
        <button class="btn btn-small" :disabled="currentPage <= 1" @click="changePage(currentPage - 1)">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页（共 {{ totalUsers }} 条）</span>
        <button class="btn btn-small" :disabled="currentPage >= totalPages" @click="changePage(currentPage + 1)">下一页</button>
      </div>
    </div>

    <!-- 重置密码弹窗 -->
    <div v-if="resetPasswordModal" class="modal-overlay" @click.self="closeResetPassword">
      <div class="modal">
        <div class="modal-header">
          <h3>🔑 重置用户密码</h3>
          <button class="modal-close" @click="closeResetPassword">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-user-info">用户：<strong>{{ resetPasswordUser?.username }}</strong></p>
          <div class="form-group">
            <label>新密码</label>
            <input
              v-model="resetNewPassword"
              type="password"
              placeholder="请输入新密码（至少6位）"
              class="form-input"
              @keyup.enter="submitResetPassword"
            />
          </div>
          <div v-if="resetPasswordError" class="msg msg-error">{{ resetPasswordError }}</div>
          <div v-if="resetPasswordMsg" class="msg msg-success">{{ resetPasswordMsg }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeResetPassword">取消</button>
          <button
            class="btn"
            @click="submitResetPassword"
            :disabled="resetPasswordLoading || !resetNewPassword"
          >
            {{ resetPasswordLoading ? '提交中...' : '确认重置' }}
          </button>
        </div>
      </div>
    </div>
    <!-- 查看完整配置弹窗 -->
    <div v-if="fullConfigModal" class="modal-overlay" @click.self="closeFullConfig">
      <div class="modal modal-wide">
        <div class="modal-header">
          <h3>🔑 用户完整配置 - {{ fullConfigUsername }}</h3>
          <button class="modal-close" @click="closeFullConfig">&times;</button>
        </div>
        <div class="modal-body">
          <div v-if="fullConfigLoading" class="detail-loading">加载中...</div>
          <div v-else-if="!fullConfigData" class="empty">该用户未配置 API</div>
          <div v-else class="full-config-list">
            <div v-for="(cfg, service) in fullConfigData" :key="service" class="full-config-item">
              <div class="full-config-service">{{ serviceLabels[service as string] || service }}</div>
              <div class="full-config-fields">
                <div v-for="(value, field) in cfg" :key="field" class="full-config-field">
                  <span class="full-config-label">{{ fieldLabels[field as string] || field }}：</span>
                  <span class="full-config-value" :class="{ 'is-key': (field as string).toLowerCase().includes('key') }">
                    {{ value || '（未配置）' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeFullConfig">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

/* ============ 统计卡片 ============ */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #1e1e2e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.stat-number {
  font-size: 32px;
  font-weight: 700;
  color: #a78bfa;
}

.stat-label {
  font-size: 13px;
  color: #888;
  margin-top: 4px;
}

/* ============ 平台分布 ============ */
.platform-stats {
  background: #1e1e2e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 24px;
}

.platform-stats h3 {
  font-size: 14px;
  color: #aaa;
  margin: 0 0 10px 0;
}

.platform-tags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.platform-tag {
  background: #2a2a3e;
  color: #c4b5fd;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
}

/* ============ 卡片 ============ */
.card {
  background: #1e1e2e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 10px;
}

.card-title {
  font-size: 18px;
  margin: 0;
  color: #e0e0e0;
}

.card-header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 6px 12px;
  color: #e0e0e0;
  font-size: 13px;
  width: 160px;
}

.search-input::placeholder {
  color: #666;
}

.role-filter {
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 6px 10px;
  color: #e0e0e0;
  font-size: 13px;
}

/* ============ 表格 ============ */
.table-wrapper {
  overflow-x: auto;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.user-table th {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 2px solid #333;
  color: #888;
  font-weight: 600;
  white-space: nowrap;
}

.user-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #2a2a3e;
  color: #ccc;
}

.user-table tr:hover {
  background: #252536;
}

.username-cell {
  font-weight: 600;
  color: #e0e0e0 !important;
}

.role-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.role-badge.admin {
  background: #7c3aed33;
  color: #a78bfa;
}

.role-badge.user {
  background: #06b6d433;
  color: #67e8f9;
}

/* ============ 按钮 ============ */
.btn {
  background: #7c3aed;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.btn:hover:not(:disabled) {
  background: #6d28d9;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-warn {
  background: #b45309;
}

.btn-warn:hover:not(:disabled) {
  background: #92400e;
}

.action-btns {
  display: flex;
  gap: 6px;
}

/* ============ 分页 ============ */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

.page-info {
  font-size: 13px;
  color: #888;
}

/* ============ 详情面板（内联表格行） ============ */
.detail-inline-row > .detail-inline-cell {
  padding: 0;
  background: #1a1a2e;
}
.detail-panel {
  background: #1e1e2e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 20px;
  margin: 8px 12px;
}
tr.row-expanded > td {
  background: #252540;
}

.detail-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid #333;
  padding-bottom: 12px;
}

.tab-btn {
  background: transparent;
  border: 1px solid #444;
  color: #aaa;
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #7c3aed;
  border-color: #7c3aed;
  color: white;
}

.tab-btn:hover:not(.active) {
  border-color: #666;
  color: #ddd;
}

.detail-loading {
  text-align: center;
  padding: 20px;
  color: #888;
}

.detail-content {
  min-height: 100px;
}

/* ============ 用户基本信息 ============ */
.user-basic-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
  margin-bottom: 20px;
  padding: 16px;
  background: #252536;
  border-radius: 8px;
}

.user-basic-info p {
  margin: 0;
  font-size: 13px;
  color: #ccc;
}

.user-basic-info strong {
  color: #888;
}

/* ============ 配置信息 ============ */
.config-section h4 {
  color: #aaa;
  font-size: 14px;
  margin: 0 0 12px 0;
}

.config-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.config-section-header h4 {
  color: #aaa;
  font-size: 14px;
  margin: 0;
}

.config-item {
  background: #252536;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
}

.config-service {
  font-weight: 600;
  color: #a78bfa;
  margin-bottom: 6px;
  font-size: 14px;
}

.config-detail {
  font-size: 13px;
  color: #ccc;
  margin-top: 4px;
}

.config-label {
  color: #888;
  margin-right: 8px;
}

.config-value.mono {
  font-family: monospace;
  color: #67e8f9;
}

/* ============ 任务卡片 ============ */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-card {
  background: #252536;
  border-radius: 8px;
  padding: 14px 16px;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.platform-badge {
  background: #2a2a3e;
  color: #c4b5fd;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.status-badge.completed {
  background: #065f4633;
  color: #4ade80;
}

.status-badge.processing {
  background: #854d0e33;
  color: #facc15;
}

.status-badge.queued {
  background: #1e40af33;
  color: #60a5fa;
}

.status-badge.failed {
  background: #7f1d1d33;
  color: #f87171;
}

.task-time {
  font-size: 12px;
  color: #666;
  margin-left: auto;
}

.task-prompt {
  font-size: 13px;
  color: #ccc;
  line-height: 1.5;
  margin-bottom: 8px;
  word-break: break-all;
}

.task-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #888;
}

.video-link {
  color: #a78bfa;
  text-decoration: none;
}

.video-link:hover {
  text-decoration: underline;
}

/* ============ 图片预览 ============ */
.image-preview {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.preview-thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #444;
}

/* ============ 空状态 ============ */
.empty {
  text-align: center;
  padding: 24px;
  color: #666;
  font-size: 14px;
}

/* ============ 弹窗 ============ */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #1e1e2e;
  border: 1px solid #444;
  border-radius: 12px;
  width: 420px;
  max-width: 90vw;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #333;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #e0e0e0;
}

.modal-close {
  background: none;
  border: none;
  color: #888;
  font-size: 22px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #e0e0e0;
}

.modal-body {
  padding: 20px;
}

.modal-user-info {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: #ccc;
}

.modal-user-info strong {
  color: #a78bfa;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #888;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e0e0e0;
  font-size: 14px;
  box-sizing: border-box;
}

.form-input::placeholder {
  color: #666;
}

.form-input:focus {
  outline: none;
  border-color: #7c3aed;
}

.msg {
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 6px;
  margin-top: 8px;
}

.msg-error {
  background: #7f1d1d33;
  color: #f87171;
}

.msg-success {
  background: #065f4633;
  color: #4ade80;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid #333;
}

/* ============ 完整配置弹窗 ============ */
.modal-wide {
  width: 640px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-wide .modal-body {
  overflow-y: auto;
  flex: 1;
}

.full-config-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.full-config-item {
  background: #252536;
  border-radius: 8px;
  padding: 14px 16px;
}

.full-config-service {
  font-weight: 600;
  color: #a78bfa;
  font-size: 15px;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #333;
}

.full-config-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.full-config-field {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
}

.full-config-label {
  color: #888;
  min-width: 110px;
  flex-shrink: 0;
}

.full-config-value {
  color: #ccc;
  word-break: break-all;
}

.full-config-value.is-key {
  font-family: monospace;
  color: #67e8f9;
  background: #1a1a2e;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}
</style>

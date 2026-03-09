<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { announcementApi, type AnnouncementItem } from '@/api'
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
const announcements = ref<AnnouncementItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

// 添加/编辑弹窗
const editModal = ref(false)
const editTarget = ref<AnnouncementItem | null>(null) // null=新建，否则=编辑
const editForm = ref({
  content: '',
  publishDate: '',
  type: 'default',
  description: '',
})
const editLoading = ref(false)
const editMsg = ref('')
const editError = ref('')

// 删除确认
const deleteModal = ref(false)
const deleteTarget = ref<AnnouncementItem | null>(null)
const deleteLoading = ref(false)

// ============ 格式化 ============
const formatTime = (ts: string) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}

const typeLabel: Record<string, string> = {
  default: '默认',
  important: '重要',
  urgent: '紧急',
}

const typeBadgeClass: Record<string, string> = {
  default: 'type-default',
  important: 'type-important',
  urgent: 'type-urgent',
}

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)

const contentCharCount = computed(() => editForm.value.content.length)

// ============ 加载数据 ============
const loadAnnouncements = async () => {
  loading.value = true
  try {
    const res = await announcementApi.getList({
      page: currentPage.value,
      limit: pageSize.value,
    })
    announcements.value = res.data.data
    total.value = res.data.total
  } catch (e: any) {
    console.error('加载公告列表失败:', e)
  } finally {
    loading.value = false
  }
}

const changePage = (page: number) => {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadAnnouncements()
}

// ============ 新建公告 ============
const openCreate = () => {
  editTarget.value = null
  editForm.value = {
    content: '',
    publishDate: formatDateForInput(new Date()),
    type: 'default',
    description: '',
  }
  editMsg.value = ''
  editError.value = ''
  editModal.value = true
}

// ============ 编辑公告 ============
const openEdit = (item: AnnouncementItem) => {
  editTarget.value = item
  editForm.value = {
    content: item.content,
    publishDate: formatDateForInput(new Date(item.publishDate)),
    type: item.type || 'default',
    description: item.description || '',
  }
  editMsg.value = ''
  editError.value = ''
  editModal.value = true
}

const closeEdit = () => {
  editModal.value = false
  editTarget.value = null
}

/**
 * 投递日期为 datetime-local 格式
 */
function formatDateForInput(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ============ 提交创建/更新 ============
const submitEdit = async () => {
  if (!editForm.value.content.trim()) {
    editError.value = '公告内容不能为空'
    return
  }
  if (editForm.value.content.length > 500) {
    editError.value = '公告内容不能超过500字'
    return
  }
  editLoading.value = true
  editError.value = ''
  editMsg.value = ''
  try {
    const payload = {
      content: editForm.value.content.trim(),
      publishDate: editForm.value.publishDate ? new Date(editForm.value.publishDate).toISOString() : undefined,
      type: editForm.value.type,
      description: editForm.value.description.trim() || undefined,
    }
    if (editTarget.value) {
      // 更新
      await announcementApi.update(editTarget.value._id, payload)
      editMsg.value = '更新成功'
    } else {
      // 创建
      await announcementApi.create(payload)
      editMsg.value = '创建成功'
    }
    await loadAnnouncements()
    setTimeout(() => closeEdit(), 1200)
  } catch (e: any) {
    editError.value = e.response?.data?.message || '操作失败'
  } finally {
    editLoading.value = false
  }
}

// ============ 删除公告 ============
const openDelete = (item: AnnouncementItem) => {
  deleteTarget.value = item
  deleteModal.value = true
}

const closeDelete = () => {
  deleteModal.value = false
  deleteTarget.value = null
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  try {
    await announcementApi.delete(deleteTarget.value._id)
    await loadAnnouncements()
    closeDelete()
  } catch (e: any) {
    console.error('删除公告失败:', e)
  } finally {
    deleteLoading.value = false
  }
}

// ============ 初始化 ============
onMounted(() => {
  loadAnnouncements()
})
</script>

<template>
  <div class="admin-announcement">
    <div class="page-header">
      <h1>📢 公告管理</h1>
      <div class="header-actions">
        <button class="btn" @click="openCreate">+ 添加公告</button>
        <router-link to="/admin" class="btn btn-secondary">← 返回用户管理</router-link>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-number">{{ total }}</div>
        <div class="stat-label">公告总数</div>
      </div>
    </div>

    <!-- 列表 -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">📋 公告列表</h2>
        <div class="card-header-actions">
          <button class="btn btn-secondary" @click="loadAnnouncements" :disabled="loading">
            {{ loading ? '加载中...' : '刷新' }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="announcements.length === 0" class="empty">暂无公告</div>

      <div v-else class="announcement-list">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40%">内容</th>
              <th style="width: 15%">发布日期</th>
              <th style="width: 10%">类型</th>
              <th style="width: 15%">说明</th>
              <th style="width: 10%">创建时间</th>
              <th style="width: 10%">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in announcements" :key="item._id">
              <td class="content-cell">
                <div class="content-preview">{{ item.content }}</div>
              </td>
              <td>{{ formatTime(item.publishDate) }}</td>
              <td>
                <span class="type-badge" :class="typeBadgeClass[item.type] || 'type-default'">
                  {{ typeLabel[item.type] || item.type }}
                </span>
              </td>
              <td class="desc-cell">{{ item.description || '-' }}</td>
              <td>{{ formatTime(item.createdAt) }}</td>
              <td>
                <div class="action-btns">
                  <button class="btn btn-small" @click="openEdit(item)">✏️ 编辑</button>
                  <button class="btn btn-small btn-danger" @click="openDelete(item)">🗑️ 删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div class="pagination" v-if="totalPages > 1">
        <button class="btn btn-small" :disabled="currentPage <= 1" @click="changePage(currentPage - 1)">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页（共 {{ total }} 条）</span>
        <button class="btn btn-small" :disabled="currentPage >= totalPages" @click="changePage(currentPage + 1)">下一页</button>
      </div>
    </div>

    <!-- 添加/编辑公告弹窗 -->
    <div v-if="editModal" class="modal-overlay" @click.self="closeEdit">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editTarget ? '✏️ 编辑公告' : '📢 添加公告' }}</h3>
          <button class="modal-close" @click="closeEdit">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>公告内容 <span class="char-count" :class="{ over: contentCharCount > 500 }">({{ contentCharCount }}/500)</span></label>
            <textarea
              v-model="editForm.content"
              class="form-textarea"
              placeholder="请输入公告内容，支持 Markdown / HTML 格式..."
              rows="6"
              maxlength="500"
            ></textarea>
          </div>

          <div class="form-group">
            <label>发布日期</label>
            <input
              v-model="editForm.publishDate"
              type="datetime-local"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>类型</label>
            <select v-model="editForm.type" class="form-select">
              <option value="default">默认</option>
              <option value="important">重要</option>
              <option value="urgent">紧急</option>
            </select>
          </div>

          <div class="form-group">
            <label>说明（可选）</label>
            <input
              v-model="editForm.description"
              type="text"
              class="form-input"
              placeholder="补充说明..."
            />
          </div>

          <div v-if="editError" class="msg msg-error">{{ editError }}</div>
          <div v-if="editMsg" class="msg msg-success">{{ editMsg }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeEdit">取消</button>
          <button class="btn" @click="submitEdit" :disabled="editLoading || !editForm.content.trim()">
            {{ editLoading ? '提交中...' : (editTarget ? '保存修改' : '发布公告') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="deleteModal" class="modal-overlay" @click.self="closeDelete">
      <div class="modal modal-small">
        <div class="modal-header">
          <h3>确认删除</h3>
          <button class="modal-close" @click="closeDelete">&times;</button>
        </div>
        <div class="modal-body">
          <p class="delete-warn">确定要删除这条公告吗？此操作不可恢复。</p>
          <div class="delete-preview">{{ deleteTarget?.content }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeDelete">取消</button>
          <button class="btn btn-danger" @click="confirmDelete" :disabled="deleteLoading">
            {{ deleteLoading ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-announcement {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 22px;
  color: #e0e0e0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* ============ 统计卡片 ============ */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: #1e1e2e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.stat-number {
  font-size: 28px;
  font-weight: 700;
  color: #a78bfa;
}

.stat-label {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

/* ============ 卡片 ============ */
.card {
  background: #1e1e2e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
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
}

/* ============ 表格 ============ */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  text-align: left;
  color: #888;
  font-weight: 600;
  padding: 10px 12px;
  border-bottom: 1px solid #333;
  font-size: 12px;
}

.data-table td {
  padding: 12px;
  color: #ccc;
  border-bottom: 1px solid #2a2a3e;
  vertical-align: top;
}

.data-table tr:hover td {
  background: #252536;
}

.content-cell {
  max-width: 320px;
}

.content-preview {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  word-break: break-all;
  color: #e0e0e0;
}

.desc-cell {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* ============ 类型徽章 ============ */
.type-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.type-default {
  background: #374151;
  color: #9ca3af;
}

.type-important {
  background: #854d0e33;
  color: #facc15;
}

.type-urgent {
  background: #7f1d1d33;
  color: #f87171;
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
  text-decoration: none;
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

.btn-danger {
  background: #991b1b;
}

.btn-danger:hover:not(:disabled) {
  background: #7f1d1d;
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
  width: 560px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-small {
  width: 420px;
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

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid #333;
}

/* ============ 表单 ============ */
.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #888;
  margin-bottom: 6px;
}

.char-count {
  font-size: 12px;
  color: #666;
}

.char-count.over {
  color: #f87171;
}

.form-textarea,
.form-select,
.form-input {
  width: 100%;
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e0e0e0;
  font-size: 14px;
  box-sizing: border-box;
  font-family: inherit;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-textarea:focus,
.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #7c3aed;
}

/* ============ 消息提示 ============ */
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

/* ============ 删除确认 ============ */
.delete-warn {
  color: #f87171;
  font-size: 14px;
  margin: 0 0 12px;
}

.delete-preview {
  font-size: 13px;
  color: #aaa;
  background: #252536;
  border-radius: 6px;
  padding: 10px 12px;
  line-height: 1.5;
  max-height: 100px;
  overflow-y: auto;
  word-break: break-all;
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

/* ============ 空状态 ============ */
.loading,
.empty {
  text-align: center;
  padding: 30px;
  color: #666;
  font-size: 14px;
}
</style>

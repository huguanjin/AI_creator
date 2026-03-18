<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { promptTemplateApi, type PromptTemplateItem } from '@/api'
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
const templates = ref<PromptTemplateItem[]>([])

// 添加/编辑弹窗
const editModal = ref(false)
const editTarget = ref<PromptTemplateItem | null>(null)
const editForm = ref({
  name: '',
  content: '',
  category: '默认',
  sort: 0,
  enabled: true,
})
const editLoading = ref(false)
const editMsg = ref('')
const editError = ref('')

// 删除确认
const deleteModal = ref(false)
const deleteTarget = ref<PromptTemplateItem | null>(null)
const deleteLoading = ref(false)

// ============ 格式化 ============
const formatTime = (ts: number) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}

// 统计
const stats = computed(() => {
  const total = templates.value.length
  const enabled = templates.value.filter(t => t.enabled).length
  const categories = new Set(templates.value.map(t => t.category)).size
  return { total, enabled, categories }
})

// ============ 加载数据 ============
const loadTemplates = async () => {
  loading.value = true
  try {
    const res = await promptTemplateApi.getAll()
    templates.value = res.data.data
  } catch (e: any) {
    console.error('加载模板列表失败:', e)
  } finally {
    loading.value = false
  }
}

// ============ 新建模板 ============
const openCreate = () => {
  editTarget.value = null
  editForm.value = {
    name: '',
    content: '',
    category: '默认',
    sort: 0,
    enabled: true,
  }
  editMsg.value = ''
  editError.value = ''
  editModal.value = true
}

// ============ 编辑模板 ============
const openEdit = (item: PromptTemplateItem) => {
  editTarget.value = item
  editForm.value = {
    name: item.name,
    content: item.content,
    category: item.category,
    sort: item.sort,
    enabled: item.enabled,
  }
  editMsg.value = ''
  editError.value = ''
  editModal.value = true
}

const closeEdit = () => {
  editModal.value = false
  editTarget.value = null
}

// ============ 提交创建/更新 ============
const submitEdit = async () => {
  if (!editForm.value.name.trim() || !editForm.value.content.trim()) {
    editError.value = '名称和内容为必填项'
    return
  }
  editLoading.value = true
  editError.value = ''
  editMsg.value = ''
  try {
    const payload = {
      name: editForm.value.name.trim(),
      content: editForm.value.content.trim(),
      category: editForm.value.category.trim() || '默认',
      sort: editForm.value.sort,
      enabled: editForm.value.enabled,
    }
    if (editTarget.value) {
      await promptTemplateApi.update(editTarget.value._id, payload)
      editMsg.value = '更新成功'
    } else {
      await promptTemplateApi.create(payload)
      editMsg.value = '创建成功'
    }
    await loadTemplates()
    setTimeout(() => closeEdit(), 800)
  } catch (e: any) {
    editError.value = e.response?.data?.message || '操作失败'
  } finally {
    editLoading.value = false
  }
}

// ============ 切换启用/禁用 ============
const toggleEnabled = async (item: PromptTemplateItem) => {
  try {
    await promptTemplateApi.toggleEnabled(item._id)
    await loadTemplates()
  } catch (e: any) {
    console.error('切换状态失败:', e)
  }
}

// ============ 删除 ============
const openDelete = (item: PromptTemplateItem) => {
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
    await promptTemplateApi.delete(deleteTarget.value._id)
    await loadTemplates()
    closeDelete()
  } catch (e: any) {
    console.error('删除失败:', e)
  } finally {
    deleteLoading.value = false
  }
}

onMounted(() => {
  loadTemplates()
})
</script>

<template>
  <div class="admin-prompt-template">
    <header class="page-header">
      <h1>📝 提示词模板管理</h1>
      <p class="desc">管理图片创作的提示词模板，用户可在图片创作页面选择使用</p>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-bar">
      <div class="stat-card">
        <span class="label">总模板数</span>
        <span class="value">{{ stats.total }}</span>
      </div>
      <div class="stat-card">
        <span class="label">已启用</span>
        <span class="value text-green">{{ stats.enabled }}</span>
      </div>
      <div class="stat-card">
        <span class="label">分类数</span>
        <span class="value">{{ stats.categories }}</span>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        ➕ 新建模板
      </button>
    </div>

    <!-- 模板列表 -->
    <div class="template-list">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="templates.length === 0" class="empty">暂无模板，点击上方按钮创建</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th style="width: 120px;">名称</th>
            <th style="width: 100px;">分类</th>
            <th>内容预览</th>
            <th style="width: 60px;">排序</th>
            <th style="width: 80px;">状态</th>
            <th style="width: 160px;">创建时间</th>
            <th style="width: 140px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in templates" :key="item._id">
            <td class="name-cell">{{ item.name }}</td>
            <td>{{ item.category }}</td>
            <td class="content-preview">{{ item.content.slice(0, 80) }}{{ item.content.length > 80 ? '...' : '' }}</td>
            <td class="center">{{ item.sort }}</td>
            <td class="center">
              <span :class="['status-badge', item.enabled ? 'enabled' : 'disabled']">
                {{ item.enabled ? '启用' : '禁用' }}
              </span>
            </td>
            <td>{{ formatTime(item.createdAt) }}</td>
            <td class="actions">
              <button class="btn btn-sm btn-outline" @click="openEdit(item)">编辑</button>
              <button class="btn btn-sm" :class="item.enabled ? 'btn-warning' : 'btn-success'" @click="toggleEnabled(item)">
                {{ item.enabled ? '禁用' : '启用' }}
              </button>
              <button class="btn btn-sm btn-danger" @click="openDelete(item)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="editModal" class="modal-overlay" @click.self="closeEdit">
      <div class="modal-content">
        <h3>{{ editTarget ? '编辑模板' : '新建模板' }}</h3>
        <div class="form-group">
          <label>名称 <span class="required">*</span></label>
          <input v-model="editForm.name" type="text" placeholder="例如：赛博朋克风格" />
        </div>
        <div class="form-group">
          <label>分类</label>
          <input v-model="editForm.category" type="text" placeholder="例如：风格类、场景类" />
        </div>
        <div class="form-group">
          <label>内容 <span class="required">*</span></label>
          <textarea v-model="editForm.content" rows="6" placeholder="输入提示词模板内容，用户选择后会填充到提示词输入框"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label>排序</label>
            <input v-model.number="editForm.sort" type="number" min="0" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label>状态</label>
            <select v-model="editForm.enabled">
              <option :value="true">启用</option>
              <option :value="false">禁用</option>
            </select>
          </div>
        </div>
        <div v-if="editError" class="error-msg">{{ editError }}</div>
        <div v-if="editMsg" class="success-msg">{{ editMsg }}</div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="closeEdit" :disabled="editLoading">取消</button>
          <button class="btn btn-primary" @click="submitEdit" :disabled="editLoading">
            {{ editLoading ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="deleteModal" class="modal-overlay" @click.self="closeDelete">
      <div class="modal-content modal-sm">
        <h3>确认删除</h3>
        <p>确定要删除模板 <strong>{{ deleteTarget?.name }}</strong> 吗？</p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="closeDelete" :disabled="deleteLoading">取消</button>
          <button class="btn btn-danger" @click="confirmDelete" :disabled="deleteLoading">
            {{ deleteLoading ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-prompt-template {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  margin: 0 0 8px 0;
}

.page-header .desc {
  color: #666;
  margin: 0;
}

.stats-bar {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.stat-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-card .label {
  font-size: 12px;
  color: #666;
}

.stat-card .value {
  font-size: 20px;
  font-weight: 600;
}

.text-green {
  color: #22c55e;
}

.template-list {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.loading,
.empty {
  padding: 48px;
  text-align: center;
  color: #666;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.data-table th {
  background: #f8f9fa;
  font-weight: 600;
  font-size: 13px;
  color: #374151;
}

.data-table td {
  font-size: 14px;
}

.name-cell {
  font-weight: 500;
}

.content-preview {
  color: #666;
  font-size: 13px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.center {
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-badge.enabled {
  background: #dcfce7;
  color: #166534;
}

.status-badge.disabled {
  background: #fee2e2;
  color: #991b1b;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-outline {
  background: #fff;
  border: 1px solid #d1d5db;
  color: #374151;
}

.btn-outline:hover {
  background: #f3f4f6;
}

.btn-success {
  background: #22c55e;
  color: #fff;
}

.btn-warning {
  background: #f59e0b;
  color: #fff;
}

.btn-danger {
  background: #ef4444;
  color: #fff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content.modal-sm {
  width: 400px;
}

.modal-content h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
}

.form-group .required {
  color: #ef4444;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group textarea {
  resize: vertical;
  font-family: inherit;
}

.form-row {
  display: flex;
  gap: 16px;
}

.error-msg {
  background: #fee2e2;
  color: #991b1b;
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
}

.success-msg {
  background: #dcfce7;
  color: #166534;
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
</style>

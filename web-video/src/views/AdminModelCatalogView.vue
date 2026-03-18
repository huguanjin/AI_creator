<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { modelCatalogApi, type ModelCatalogItem } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

if (!authStore.isAdmin) {
  router.replace('/')
}

// ============ 状态 ============
const loading = ref(false)
const models = ref<ModelCatalogItem[]>([])
const filterPlatform = ref<string>('')
const seedLoading = ref(false)
const seedMsg = ref('')

// 添加/编辑弹窗
const editModal = ref(false)
const editTarget = ref<ModelCatalogItem | null>(null)
const editForm = ref({
  platform: 'kling',
  category: '',
  name: '',
  value: '',
  sort: 0,
  enabled: true,
})
const editLoading = ref(false)
const editMsg = ref('')
const editError = ref('')

// 删除确认
const deleteModal = ref(false)
const deleteTarget = ref<ModelCatalogItem | null>(null)
const deleteLoading = ref(false)

// ============ 辅助 ============
const platformOptions = [
  { label: '全部', value: '' },
  { label: 'Sora', value: 'sora' },
  { label: 'VEO', value: 'veo' },
  { label: 'Grok', value: 'grok' },
  { label: '豆包 (Doubao)', value: 'doubao' },
  { label: '可灵 (Kling)', value: 'kling' },
  { label: 'Vidu', value: 'vidu' },
  { label: '提示词润色', value: 'promptPolish' },
]

const platformLabel: Record<string, string> = {
  sora: 'Sora',
  veo: 'VEO',
  grok: 'Grok',
  doubao: '豆包',
  kling: '可灵',
  vidu: 'Vidu',
  promptPolish: '提示词润色',
}

const filteredModels = computed(() => {
  if (!filterPlatform.value) return models.value
  return models.value.filter(m => m.platform === filterPlatform.value)
})

const stats = computed(() => {
  const total = models.value.length
  const enabled = models.value.filter(m => m.enabled).length
  const platforms = new Set(models.value.map(m => m.platform)).size
  return { total, enabled, platforms }
})

// ============ 加载数据 ============
const loadModels = async () => {
  loading.value = true
  try {
    const res = await modelCatalogApi.getAll()
    models.value = res.data.data
  } catch (e: any) {
    console.error('加载模型列表失败:', e)
  } finally {
    loading.value = false
  }
}

// ============ 初始化默认数据 ============
const seedDefaults = async () => {
  seedLoading.value = true
  seedMsg.value = ''
  try {
    const res = await modelCatalogApi.seedDefaults()
    const count = res.data.data.inserted
    seedMsg.value = count > 0 ? `已导入 ${count} 条默认模型` : '数据库已有数据，无需初始化'
    if (count > 0) await loadModels()
  } catch (e: any) {
    seedMsg.value = e.response?.data?.message || '初始化失败'
  } finally {
    seedLoading.value = false
  }
}

// ============ 新建模型 ============
const openCreate = () => {
  editTarget.value = null
  editForm.value = {
    platform: filterPlatform.value || 'kling',
    category: '',
    name: '',
    value: '',
    sort: 0,
    enabled: true,
  }
  editMsg.value = ''
  editError.value = ''
  editModal.value = true
}

// ============ 编辑模型 ============
const openEdit = (item: ModelCatalogItem) => {
  editTarget.value = item
  editForm.value = {
    platform: item.platform,
    category: item.category,
    name: item.name,
    value: item.value,
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
  if (!editForm.value.platform || !editForm.value.category.trim() || !editForm.value.name.trim() || !editForm.value.value.trim()) {
    editError.value = '平台、分类、名称、值均为必填项'
    return
  }
  editLoading.value = true
  editError.value = ''
  editMsg.value = ''
  try {
    const payload = {
      platform: editForm.value.platform,
      category: editForm.value.category.trim(),
      name: editForm.value.name.trim(),
      value: editForm.value.value.trim(),
      sort: editForm.value.sort,
      enabled: editForm.value.enabled,
    }
    if (editTarget.value) {
      await modelCatalogApi.update(editTarget.value._id, payload)
      editMsg.value = '更新成功'
    } else {
      await modelCatalogApi.create(payload)
      editMsg.value = '创建成功'
    }
    await loadModels()
    setTimeout(() => closeEdit(), 800)
  } catch (e: any) {
    editError.value = e.response?.data?.message || '操作失败'
  } finally {
    editLoading.value = false
  }
}

// ============ 切换启用/禁用 ============
const toggleEnabled = async (item: ModelCatalogItem) => {
  try {
    await modelCatalogApi.toggleEnabled(item._id)
    await loadModels()
  } catch (e: any) {
    console.error('切换状态失败:', e)
  }
}

// ============ 删除 ============
const openDelete = (item: ModelCatalogItem) => {
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
    await modelCatalogApi.delete(deleteTarget.value._id)
    await loadModels()
    closeDelete()
  } catch (e: any) {
    console.error('删除模型失败:', e)
  } finally {
    deleteLoading.value = false
  }
}

// ============ 已有分类提示 ============
const existingCategories = computed(() => {
  const platform = editForm.value.platform
  const cats = new Set(
    models.value
      .filter(m => m.platform === platform)
      .map(m => m.category),
  )
  return [...cats]
})

// ============ 初始化 ============
onMounted(() => {
  loadModels()
})
</script>

<template>
  <div class="admin-model-catalog">
    <div class="page-header">
      <h1>📦 模型目录管理</h1>
      <div class="header-actions">
        <button class="btn" @click="openCreate">+ 添加模型</button>
        <button class="btn btn-secondary" @click="seedDefaults" :disabled="seedLoading">
          {{ seedLoading ? '初始化中...' : '🌱 初始化默认数据' }}
        </button>
        <router-link to="/admin" class="btn btn-secondary">← 返回管理</router-link>
      </div>
    </div>

    <div v-if="seedMsg" class="seed-msg">{{ seedMsg }}</div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-number">{{ stats.total }}</div>
        <div class="stat-label">模型总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.enabled }}</div>
        <div class="stat-label">已启用</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ stats.platforms }}</div>
        <div class="stat-label">平台数</div>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="filter-bar">
      <label>平台筛选：</label>
      <div class="filter-tabs">
        <button
          v-for="opt in platformOptions"
          :key="opt.value"
          class="filter-tab"
          :class="{ active: filterPlatform === opt.value }"
          @click="filterPlatform = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">📋 模型列表 ({{ filteredModels.length }})</h2>
        <div class="card-header-actions">
          <button class="btn btn-secondary" @click="loadModels" :disabled="loading">
            {{ loading ? '加载中...' : '刷新' }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="filteredModels.length === 0" class="empty">
        暂无模型数据，请点击「🌱 初始化默认数据」导入
      </div>

      <div v-else class="model-list">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 10%">平台</th>
              <th style="width: 18%">分类</th>
              <th style="width: 22%">显示名称</th>
              <th style="width: 22%">模型值</th>
              <th style="width: 8%">排序</th>
              <th style="width: 8%">状态</th>
              <th style="width: 12%">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredModels" :key="item._id" :class="{ disabled: !item.enabled }">
              <td>
                <span class="platform-badge" :class="'platform-' + item.platform">
                  {{ platformLabel[item.platform] || item.platform }}
                </span>
              </td>
              <td>{{ item.category }}</td>
              <td class="name-cell">{{ item.name }}</td>
              <td class="value-cell"><code>{{ item.value }}</code></td>
              <td>{{ item.sort }}</td>
              <td>
                <button
                  class="toggle-btn"
                  :class="{ on: item.enabled }"
                  @click="toggleEnabled(item)"
                  :title="item.enabled ? '点击禁用' : '点击启用'"
                >
                  {{ item.enabled ? '✅ 启用' : '🚫 禁用' }}
                </button>
              </td>
              <td>
                <div class="action-btns">
                  <button class="btn btn-small" @click="openEdit(item)">✏️</button>
                  <button class="btn btn-small btn-danger" @click="openDelete(item)">🗑️</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <div v-if="editModal" class="modal-overlay" @click.self="closeEdit">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editTarget ? '✏️ 编辑模型' : '📦 添加模型' }}</h3>
          <button class="modal-close" @click="closeEdit">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>平台</label>
            <select v-model="editForm.platform" class="form-select">
              <option value="sora">Sora</option>
              <option value="veo">VEO</option>
              <option value="grok">Grok</option>
              <option value="doubao">豆包 (Doubao)</option>
              <option value="kling">可灵 (Kling)</option>
              <option value="vidu">Vidu</option>
              <option value="promptPolish">提示词润色</option>
            </select>
          </div>

          <div class="form-group">
            <label>分类</label>
            <input
              v-model="editForm.category"
              type="text"
              class="form-input"
              placeholder="如：🎬 标准版、✨ 高级版、📦 按量计费组合"
            />
            <div v-if="existingCategories.length" class="category-hints">
              <span class="hint-label">已有分类：</span>
              <button
                v-for="cat in existingCategories"
                :key="cat"
                class="hint-tag"
                @click="editForm.category = cat"
              >{{ cat }}</button>
            </div>
          </div>

          <div class="form-group">
            <label>显示名称</label>
            <input
              v-model="editForm.name"
              type="text"
              class="form-input"
              placeholder="下拉菜单中显示的名称，如：Kling-3.0-Omni"
            />
          </div>

          <div class="form-group">
            <label>模型值</label>
            <input
              v-model="editForm.value"
              type="text"
              class="form-input"
              placeholder="提交给 API 的实际值，如：Kling-3.0-Omni"
            />
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label>排序（越小越靠前）</label>
              <input
                v-model.number="editForm.sort"
                type="number"
                class="form-input"
                min="0"
              />
            </div>
            <div class="form-group flex-1">
              <label>状态</label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="editForm.enabled" />
                <span>启用</span>
              </label>
            </div>
          </div>

          <div v-if="editError" class="msg msg-error">{{ editError }}</div>
          <div v-if="editMsg" class="msg msg-success">{{ editMsg }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeEdit">取消</button>
          <button class="btn" @click="submitEdit" :disabled="editLoading">
            {{ editLoading ? '提交中...' : (editTarget ? '保存修改' : '创建模型') }}
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
          <p class="delete-warn">确定要删除此模型吗？此操作不可恢复。</p>
          <div class="delete-preview">
            <strong>{{ platformLabel[deleteTarget?.platform || ''] }}</strong> /
            {{ deleteTarget?.category }} /
            {{ deleteTarget?.name }}
            <br /><code>{{ deleteTarget?.value }}</code>
          </div>
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
.admin-model-catalog {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.page-header h1 {
  margin: 0;
  font-size: 22px;
  color: #e0e0e0;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.seed-msg {
  background: #1e1e2e;
  border: 1px solid #a78bfa;
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 16px;
  color: #a78bfa;
  font-size: 13px;
}

/* ============ 统计卡片 ============ */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

/* ============ 筛选栏 ============ */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-bar label {
  color: #888;
  font-size: 13px;
  white-space: nowrap;
}

.filter-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-tab {
  background: #1e1e2e;
  border: 1px solid #333;
  color: #aaa;
  padding: 5px 14px;
  border-radius: 16px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.filter-tab:hover {
  border-color: #a78bfa;
  color: #e0e0e0;
}

.filter-tab.active {
  background: #7c3aed;
  border-color: #7c3aed;
  color: white;
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
  padding: 10px 12px;
  color: #ccc;
  border-bottom: 1px solid #2a2a3e;
  vertical-align: middle;
}

.data-table tr:hover td {
  background: #252536;
}

.data-table tr.disabled td {
  opacity: 0.5;
}

.name-cell {
  font-weight: 500;
  color: #e0e0e0;
}

.value-cell code {
  background: #2a2a3e;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #a78bfa;
}

/* ============ 平台标签 ============ */
.platform-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  font-weight: 600;
}

.platform-sora { background: #1e3a5f; color: #60a5fa; }
.platform-veo { background: #1a3a2a; color: #4ade80; }
.platform-grok { background: #3b1a1a; color: #f87171; }
.platform-doubao { background: #3b2f1a; color: #fbbf24; }
.platform-kling { background: #2e1a3b; color: #c084fc; }

/* ============ 启用/禁用按钮 ============ */
.toggle-btn {
  background: none;
  border: 1px solid #333;
  color: #888;
  padding: 3px 8px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.toggle-btn.on {
  border-color: #4ade80;
  color: #4ade80;
}

.toggle-btn:hover {
  background: #252536;
}

.action-btns {
  display: flex;
  gap: 4px;
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

.loading, .empty {
  text-align: center;
  color: #888;
  padding: 40px 20px;
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
  width: 520px;
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
  font-size: 20px;
  cursor: pointer;
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
  padding: 16px 20px;
  border-top: 1px solid #333;
}

/* ============ 表单 ============ */
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #aaa;
  margin-bottom: 6px;
}

.form-input, .form-select {
  width: 100%;
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e0e0e0;
  font-size: 13px;
  box-sizing: border-box;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #7c3aed;
}

.form-row {
  display: flex;
  gap: 16px;
}

.flex-1 {
  flex: 1;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin-top: 4px;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #7c3aed;
}

.checkbox-label span {
  color: #e0e0e0;
  font-size: 14px;
}

/* ============ 分类提示 ============ */
.category-hints {
  margin-top: 6px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.hint-label {
  font-size: 11px;
  color: #666;
}

.hint-tag {
  background: #2a2a3e;
  border: 1px solid #444;
  color: #aaa;
  padding: 2px 8px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.hint-tag:hover {
  border-color: #a78bfa;
  color: #e0e0e0;
}

/* ============ 消息 ============ */
.msg {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.msg-error {
  background: #7f1d1d33;
  color: #f87171;
  border: 1px solid #991b1b44;
}

.msg-success {
  background: #14532d33;
  color: #4ade80;
  border: 1px solid #16a34a44;
}

.delete-warn {
  color: #f87171;
  margin: 0 0 12px;
}

.delete-preview {
  background: #2a2a3e;
  padding: 12px;
  border-radius: 6px;
  color: #ccc;
  font-size: 13px;
  line-height: 1.6;
}

.delete-preview code {
  color: #a78bfa;
}

/* ============ 响应式 ============ */
@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: repeat(3, 1fr);
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .data-table {
    font-size: 12px;
  }

  .data-table th, .data-table td {
    padding: 8px 6px;
  }
}
</style>

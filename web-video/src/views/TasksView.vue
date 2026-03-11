<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useVideoStore } from '@/stores/video'

const store = useVideoStore()
const tasks = computed(() => store.tasks)
const loading = computed(() => store.loading)

const statusText: Record<string, string> = {
  queued: '排队中',
  processing: '生成中',
  completed: '已完成',
  failed: '失败',
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const deleteTask = (id: string) => {
  if (confirm('确定删除此任务？'))
    store.deleteTask(id)
}

const clearCompleted = () => {
  if (confirm('确定清除所有已完成的任务？')) {
    store.clearCompletedTasks()
  }
}

const refreshTasks = () => {
  store.loadTasks()
}

const copyPrompt = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    alert('提示词已复制')
  } catch {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    alert('提示词已复制')
  }
}

// 页面加载时从后端获取任务
onMounted(() => {
  store.loadTasks()
})
</script>

<template>
  <div class="tasks">
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          📋 任务列表
        </h2>
        <div class="card-header-actions">
          <button class="btn btn-secondary" @click="refreshTasks" :disabled="loading">
            {{ loading ? '加载中...' : '🔄 刷新' }}
          </button>
          <button v-if="tasks.length > 0" class="btn btn-secondary" @click="clearCompleted">
            清除已完成
          </button>
        </div>
      </div>

      <div v-if="loading && tasks.length === 0" class="empty">
        <p>⏳ 加载中...</p>
      </div>

      <div v-else-if="tasks.length === 0" class="empty">
        <p>🎬 暂无任务</p>
        <p style="margin-top: 8px">
          <router-link to="/" class="btn btn-primary">
            去生成视频
          </router-link>
        </p>
      </div>

      <div v-else class="task-grid">
        <div v-for="task in tasks" :key="task.id" class="video-card">
          <div class="video-preview">
            <video
              v-if="task.video_url"
              :src="task.video_url"
              controls
              preload="metadata"
            />
            <div v-else class="video-placeholder">
              <span v-if="task.status === 'queued'">⏳ 排队中</span>
              <span v-else-if="task.status === 'processing'">
                🔄 生成中 {{ task.progress }}%
              </span>
              <span v-else-if="task.status === 'failed'">❌ 失败</span>
            </div>
          </div>

          <div class="video-card-info">
            <div class="video-card-title" :title="task.prompt">
              {{ task.prompt }}
              <button class="copy-btn" @click.stop="copyPrompt(task.prompt)" title="复制提示词">📋</button>
            </div>
            <div class="video-card-id" :title="task.id">
              ID: {{ task.id }}
            </div>
            <div class="video-card-meta">
              <span class="status-badge" :class="`status-${task.status}`">
                {{ statusText[task.status] }}
              </span>
              <span>{{ task.model }}</span>
            </div>
            <div class="video-card-meta" style="margin-top: 8px">
              <span>{{ formatTime(task.created_at) }}</span>
              <span>{{ task.platform.toUpperCase() }}</span>
            </div>
            <div class="video-card-actions">
              <a
                v-if="task.video_url"
                :href="task.video_url"
                target="_blank"
                class="btn btn-secondary"
                download
              >
                下载
              </a>
              <button class="btn btn-danger" @click="deleteTask(task.id)">
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-header .card-title {
  margin-bottom: 0;
}

.card-header-actions {
  display: flex;
  gap: 8px;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.video-preview {
  aspect-ratio: 16/9;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-preview video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-placeholder {
  color: var(--text-muted);
  font-size: 14px;
}

.video-card-id {
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

.video-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.video-card-actions .btn {
  flex: 1;
  justify-content: center;
  padding: 8px 12px;
  font-size: 12px;
}

.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
  opacity: 0.5;
  transition: opacity 0.2s;
  vertical-align: middle;
}

.copy-btn:hover {
  opacity: 1;
}
</style>

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { videoTasksApi, type VideoTaskRecord } from '@/api'

export interface VideoTask {
  id: string
  model: string
  prompt: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  video_url?: string
  thumbnail_url?: string
  created_at: number
  platform: 'sora' | 'veo' | 'grok' | 'doubao' | 'kling'
  channel?: string
}

export interface Character {
  id: string
  username: string
  permalink: string
  profile_picture_url: string
  created_at: string
}

/**
 * 将后端 VideoTaskRecord 转换为前端 VideoTask
 */
function toVideoTask(record: VideoTaskRecord): VideoTask {
  return {
    id: record.externalTaskId,
    model: record.model,
    prompt: record.prompt,
    status: record.status,
    progress: record.progress,
    video_url: record.video_url,
    thumbnail_url: record.thumbnail_url,
    created_at: record.createdAt,
    platform: record.platform,
    channel: record.params?.channel,
  }
}

export const useVideoStore = defineStore('video', () => {
  const tasks = ref<VideoTask[]>([])
  const characters = ref<Character[]>([])
  const loading = ref(false)

  // 从后端 API 加载任务
  const loadTasks = async () => {
    loading.value = true
    try {
      const res = await videoTasksApi.getTasks({ limit: 200 })
      if (res.data.status === 'success') {
        tasks.value = res.data.data.map(toVideoTask)
      }
    } catch (e) {
      console.error('❌ Failed to load tasks from API:', e)
      // 降级：尝试从 localStorage 加载
      loadFromLocalStorage()
    } finally {
      loading.value = false
    }
  }

  // 降级：从 localStorage 加载（兼容老数据）
  const loadFromLocalStorage = () => {
    const savedTasks = localStorage.getItem('video_tasks')
    if (savedTasks) {
      try {
        tasks.value = JSON.parse(savedTasks)
      } catch (e) {
        tasks.value = []
      }
    }
  }

  // 从 localStorage 加载角色（角色还是本地存储）
  const loadCharactersFromStorage = () => {
    const savedCharacters = localStorage.getItem('sora_characters')
    if (savedCharacters) {
      try {
        characters.value = JSON.parse(savedCharacters)
      } catch (e) {
        characters.value = []
      }
    }
  }

  // 添加任务（本地立即添加，后端在 controller 中已自动记录）
  const addTask = (task: VideoTask) => {
    tasks.value.unshift(task)
  }

  // 更新任务（本地更新）
  const updateTask = (id: string, updates: Partial<VideoTask>) => {
    const index = tasks.value.findIndex(t => t.id === id)
    if (index !== -1) {
      tasks.value[index] = { ...tasks.value[index], ...updates }
    }
  }

  // 删除任务（调用后端 API）
  const deleteTask = async (id: string) => {
    try {
      await videoTasksApi.deleteTask(id)
    } catch (e) {
      console.error('❌ Failed to delete task from API:', e)
    }
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  // 清除已完成任务（调用后端 API）
  const clearCompletedTasks = async () => {
    try {
      await videoTasksApi.clearCompleted()
    } catch (e) {
      console.error('❌ Failed to clear completed tasks:', e)
    }
    tasks.value = tasks.value.filter(t => t.status !== 'completed')
  }

  // 添加角色
  const addCharacter = (character: Character) => {
    characters.value.unshift(character)
    localStorage.setItem('sora_characters', JSON.stringify(characters.value))
  }

  // 删除角色
  const deleteCharacter = (id: string) => {
    characters.value = characters.value.filter(c => c.id !== id)
    localStorage.setItem('sora_characters', JSON.stringify(characters.value))
  }

  // 初始化时加载
  loadCharactersFromStorage()

  return {
    tasks,
    characters,
    loading,
    loadTasks,
    addTask,
    updateTask,
    deleteTask,
    clearCompletedTasks,
    addCharacter,
    deleteCharacter,
  }
})

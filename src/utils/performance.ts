/**
 * 性能优化模块 - AIaW Pyrite Version
 * 
 * 解决的问题：
 * 1. 消息列表无限渲染导致DOM爆炸
 * 2. 手机端卡死
 * 3. 滚动事件过于频繁
 */

import { ref, computed, watch, onUnmounted, type Ref } from 'vue'

/**
 * 消息窗口化配置
 */
export const VirtualScrollConfig = {
  // 每次渲染的消息数量上限
  renderLimit: 50,
  // 预渲染的额外消息数（滚动缓冲区）
  bufferSize: 10,
  // 滚动事件节流间隔（毫秒）
  scrollThrottle: 100,
  // 存储警告阈值（MB）
  storageWarningMB: 100,
  // 存储危险阈值（MB）
  storageDangerMB: 200,
}

/**
 * 创建消息窗口化逻辑
 * @param chain 完整的消息链
 * @param scrollContainer 滚动容器引用
 */
export function useMessageWindowing(
  chain: Ref<string[]>,
  scrollContainer: Ref<HTMLElement | undefined>
) {
  // 当前可见区域的起始索引
  const visibleStart = ref(0)
  
  // 是否正在加载更多历史消息
  const isLoadingMore = ref(false)
  
  // 是否有更多历史消息可加载
  const hasMoreHistory = computed(() => visibleStart.value > 0)
  
  // 窗口化的消息链（只包含可见区域附近的消息）
  const visibleChain = computed(() => {
    const total = chain.value.length
    const start = Math.max(0, visibleStart.value - VirtualScrollConfig.bufferSize)
    const end = Math.min(total, visibleStart.value + VirtualScrollConfig.renderLimit)
    
    return {
      items: chain.value.slice(start, end),
      startIndex: start,
      total,
    }
  })
  
  // 滚动位置节流
  let scrollThrottleTimer: number | null = null
  let lastScrollTop = 0
  
  /**
   * 处理滚动事件
   */
  function handleScroll() {
    if (scrollThrottleTimer) return
    
    scrollThrottleTimer = window.setTimeout(() => {
      scrollThrottleTimer = null
      updateVisibleRange()
    }, VirtualScrollConfig.scrollThrottle)
  }
  
  /**
   * 更新可见区域
   */
  function updateVisibleRange() {
    const container = scrollContainer.value
    if (!container) return
    
    const scrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    
    // 检测是否滚动到顶部（需要加载更多）
    if (scrollTop < 100 && visibleStart.value > 0) {
      loadMoreHistory()
    }
    
    // 计算当前可见的消息索引
    const avgItemHeight = scrollHeight / chain.value.length
    const estimatedVisibleStart = Math.floor(scrollTop / avgItemHeight)
    
    visibleStart.value = Math.max(0, estimatedVisibleStart)
    lastScrollTop = scrollTop
  }
  
  /**
   * 加载更多历史消息
   */
  function loadMoreHistory() {
    if (isLoadingMore.value) return
    isLoadingMore.value = true
    
    // 扩大可见范围
    visibleStart.value = Math.max(0, visibleStart.value - VirtualScrollConfig.renderLimit)
    
    // 给DOM一点时间渲染
    setTimeout(() => {
      isLoadingMore.value = false
    }, 100)
  }
  
  /**
   * 重置窗口（用于新对话或切换）
   */
  function resetWindow() {
    visibleStart.value = 0
    lastScrollTop = 0
  }
  
  /**
   * 滚动到底部
   */
  function scrollToBottom(behavior: 'smooth' | 'auto' = 'smooth') {
    const container = scrollContainer.value
    if (!container) return
    
    // 重置窗口到最新消息
    visibleStart.value = Math.max(0, chain.value.length - VirtualScrollConfig.renderLimit)
    
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    })
  }
  
  // 监听chain变化，自动滚动到底部
  watch(
    () => chain.value.length,
    (newLen, oldLen) => {
      if (newLen > (oldLen || 0)) {
        // 新消息到达，确保渲染最新消息
        const maxStart = Math.max(0, chain.value.length - VirtualScrollConfig.renderLimit)
        if (visibleStart.value < maxStart) {
          visibleStart.value = maxStart
        }
      }
    }
  )
  
  return {
    visibleChain,
    visibleStart,
    isLoadingMore,
    hasMoreHistory,
    handleScroll,
    updateVisibleRange,
    loadMoreHistory,
    resetWindow,
    scrollToBottom,
  }
}

/**
 * 存储监控和警告
 */
export function useStorageMonitor() {
  const usageMB = ref(0)
  const quotaMB = ref(0)
  const usagePercent = ref(0)
  const isWarning = ref(false)
  const isDanger = ref(false)
  
  /**
   * 检查存储使用情况
   */
  async function checkStorage() {
    if (!navigator.storage?.estimate) {
      console.warn('Storage API not supported')
      return null
    }
    
    try {
      const estimate = await navigator.storage.estimate()
      usageMB.value = Math.round((estimate.usage || 0) / 1024 / 1024)
      quotaMB.value = Math.round((estimate.quota || 0) / 1024 / 1024)
      usagePercent.value = Math.round((usageMB.value / quotaMB.value) * 100)
      
      isWarning.value = usageMB.value > VirtualScrollConfig.storageWarningMB
      isDanger.value = usageMB.value > VirtualScrollConfig.storageDangerMB
      
      return {
        usage: usageMB.value,
        quota: quotaMB.value,
        percent: usagePercent.value,
        isWarning: isWarning.value,
        isDanger: isDanger.value,
      }
    } catch (e) {
      console.error('Failed to check storage:', e)
      return null
    }
  }
  
  /**
   * 请求持久化存储
   */
  async function requestPersistence(): Promise<boolean> {
    if (!navigator.storage?.persist) {
      console.warn('Storage persistence API not supported')
      return false
    }
    
    try {
      const isPersisted = await navigator.storage.persist()
      console.log('Storage persistence:', isPersisted ? 'granted' : 'denied')
      return isPersisted
    } catch (e) {
      console.error('Failed to request persistence:', e)
      return false
    }
  }
  
  /**
   * 检查持久化状态
   */
  async function checkPersistence(): Promise<boolean> {
    if (!navigator.storage?.persisted) return false
    
    try {
      return await navigator.storage.persisted()
    } catch {
      return false
    }
  }
  
  return {
    usageMB,
    quotaMB,
    usagePercent,
    isWarning,
    isDanger,
    checkStorage,
    requestPersistence,
    checkPersistence,
  }
}

/**
 * 简单的防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timer: number | null = null
  
  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer)
    timer = window.setTimeout(() => {
      fn.apply(this, args)
      timer = null
    }, wait)
  }
}

/**
 * 简单的节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0
  
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
    if (now - lastTime >= wait) {
      fn.apply(this, args)
      lastTime = now
    }
  }
}
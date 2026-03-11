/**
 * 虚拟滚动模块 - AIaW Pyrite Version
 *
 * 实现消息列表的虚拟滚动，解决手机端卡顿问题
 */

import { ref, computed, watch, type Ref } from 'vue'

// 配置
export const VirtualScrollConfig = {
  // 预渲染的额外消息数（滚动缓冲区）
  bufferSize: 5,
  // 默认消息高度估算（像素）
  defaultItemHeight: 150,
  // 最小渲染消息数
  minRenderCount: 10,
  // 最大渲染消息数
  maxRenderCount: 50
}

/**
 * 创建虚拟滚动逻辑
 */
export function useVirtualScroll(chain: Ref<string[]>) {
  // 可见区域的起始索引
  const visibleStart = ref(0)

  // 可见区域的结束索引
  const visibleEnd = ref(VirtualScrollConfig.minRenderCount)

  // 容器引用
  const containerRef = ref<HTMLElement | null>(null)

  // 是否正在生成消息（流式输出）
  const isGenerating = ref(false)

  // 消息高度缓存（用于更精确的估算）
  const heightCache = new Map<string, number>()

  /**
   * 计算可见的消息索引范围
   */
  function updateVisibleRange() {
    const container = containerRef.value
    if (!container) return

    const scrollTop = container.scrollTop
    const clientHeight = container.clientHeight
    const scrollHeight = container.scrollHeight

    // 如果正在生成消息，确保最后几条消息可见
    if (isGenerating.value) {
      visibleStart.value = Math.max(0, chain.value.length - VirtualScrollConfig.maxRenderCount)
      visibleEnd.value = chain.value.length
      return
    }

    // 估算平均消息高度
    const avgHeight = scrollHeight / Math.max(1, chain.value.length)

    // 计算当前可见区域的起始索引
    const estimatedStart = Math.floor(scrollTop / avgHeight)
    const estimatedEnd = Math.ceil((scrollTop + clientHeight) / avgHeight)

    // 添加缓冲区
    visibleStart.value = Math.max(0, estimatedStart - VirtualScrollConfig.bufferSize)
    visibleEnd.value = Math.min(chain.value.length, estimatedEnd + VirtualScrollConfig.bufferSize)

    // 确保至少渲染最小数量
    if (visibleEnd.value - visibleStart.value < VirtualScrollConfig.minRenderCount) {
      visibleEnd.value = Math.min(chain.value.length, visibleStart.value + VirtualScrollConfig.minRenderCount)
    }
  }

  /**
   * 滚动事件处理（节流）
   */
  let scrollThrottleTimer: number | null = null
  function onVirtualScroll() {
    if (scrollThrottleTimer) return
    scrollThrottleTimer = window.setTimeout(() => {
      scrollThrottleTimer = null
      updateVisibleRange()
    }, 100)
  }

  /**
   * 滚动到底部
   */
  function scrollToBottom(behavior: 'smooth' | 'auto' = 'smooth') {
    const container = containerRef.value
    if (!container) return

    // 确保最后几条消息在渲染范围内
    visibleStart.value = Math.max(0, chain.value.length - VirtualScrollConfig.maxRenderCount)
    visibleEnd.value = chain.value.length

    // 滚动到底部
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior
      })
    })
  }

  /**
   * 滚动到指定消息
   */
  function scrollToMessage(messageId: string) {
    const index = chain.value.indexOf(messageId)
    if (index === -1) return

    // 确保目标消息在渲染范围内
    visibleStart.value = Math.max(0, index - VirtualScrollConfig.bufferSize)
    visibleEnd.value = Math.min(chain.value.length, index + VirtualScrollConfig.bufferSize + 1)

    // 滚动到目标消息
    requestAnimationFrame(() => {
      const container = containerRef.value
      if (!container) return

      const messageEl = container.querySelector(`[data-message-id="${messageId}"]`)
      if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }

  /**
   * 重置虚拟滚动状态
   */
  function reset() {
    visibleStart.value = 0
    visibleEnd.value = VirtualScrollConfig.minRenderCount
    heightCache.clear()
  }

  // 监听chain变化，自动调整可见范围
  watch(
    () => chain.value.length,
    (newLen, oldLen) => {
      if (newLen > (oldLen || 0)) {
        // 新消息到达，扩展可见范围
        visibleEnd.value = newLen

        // 如果正在生成，确保滚动到底部
        if (isGenerating.value) {
          scrollToBottom('auto')
        }
      }
    }
  )

  // 计算可见的消息ID列表
  const visibleChain = computed(() => {
    return chain.value.slice(visibleStart.value, visibleEnd.value)
  })

  // 计算起始索引（用于v-for中的正确索引）
  const startIndex = computed(() => visibleStart.value)

  // 计算总消息数
  const totalCount = computed(() => chain.value.length)

  // 是否有更多历史消息可加载
  const hasMoreHistory = computed(() => visibleStart.value > 0)

  return {
    // 状态
    visibleStart,
    visibleEnd,
    visibleChain,
    startIndex,
    totalCount,
    hasMoreHistory,
    isGenerating,
    containerRef,

    // 方法
    updateVisibleRange,
    onVirtualScroll,
    scrollToBottom,
    scrollToMessage,
    reset
  }
}

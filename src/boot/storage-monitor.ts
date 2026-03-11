/**
 * 存储监控 Boot Module
 * 
 * 在应用启动时：
 * 1. 请求持久化存储（防止浏览器清理IndexedDB）
 * 2. 检查存储使用情况
 * 3. 显示警告（如果存储空间不足）
 */

import { boot } from 'quasar/wrappers'
import { LocalStorage, Notify } from 'quasar'

// 存储警告阈值（MB）
const STORAGE_WARNING_MB = 100
const STORAGE_DANGER_MB = 200

// 是否已经显示过警告（避免重复提示）
let warningShown = false

/**
 * 检查存储使用情况
 */
async function checkStorageUsage(): Promise<{
  usage: number
  quota: number
  percent: number
} | null> {
  if (!navigator.storage?.estimate) {
    return null
  }
  
  try {
    const estimate = await navigator.storage.estimate()
    const usageMB = Math.round((estimate.usage || 0) / 1024 / 1024)
    const quotaMB = Math.round((estimate.quota || 0) / 1024 / 1024)
    const percent = Math.round((usageMB / quotaMB) * 100)
    
    return { usage: usageMB, quota: quotaMB, percent }
  } catch (e) {
    console.error('[Storage] Failed to check storage:', e)
    return null
  }
}

/**
 * 请求持久化存储
 */
async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    console.log('[Storage] Persistence API not supported')
    return false
  }
  
  try {
    const isPersisted = await navigator.storage.persist()
    
    if (isPersisted) {
      console.log('[Storage] ✓ Persistence granted - data will not be cleared automatically')
    } else {
      console.warn('[Storage] ✗ Persistence denied - browser may clear data under storage pressure')
    }
    
    return isPersisted
  } catch (e) {
    console.error('[Storage] Failed to request persistence:', e)
    return false
  }
}

/**
 * 检查持久化状态
 */
async function checkPersistenceStatus(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false
  
  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}

/**
 * 显示存储警告
 */
function showStorageWarning(usageMB: number, isDanger: boolean) {
  if (warningShown) return
  warningShown = true
  
  const message = isDanger
    ? `存储空间使用已达 ${usageMB}MB，建议立即导出备份，否则可能导致数据丢失！`
    : `存储空间使用已达 ${usageMB}MB，建议定期导出备份。`
  
  Notify.create({
    message,
    color: isDanger ? 'negative' : 'warning',
    textColor: 'white',
    icon: isDanger ? 'warning' : 'info',
    timeout: 10000,
    position: 'top',
    actions: [
      {
        label: '知道了',
        color: 'white',
      },
    ],
  })
}

/**
 * 显示持久化状态提示
 */
function showPersistenceInfo(isPersisted: boolean) {
  if (isPersisted) {
    console.log('[Storage] ✓ Data is protected from automatic cleanup')
  } else {
    // 只在非持久化时显示一次提示
    const hasShownTip = LocalStorage.getItem('storage-persistence-tip-shown')
    if (hasShownTip) return
    
    Notify.create({
      message: '建议使用"导出数据"功能定期备份，以防浏览器清理缓存时丢失数据',
      color: 'info',
      textColor: 'white',
      icon: 'cloud_download',
      timeout: 8000,
      position: 'bottom',
      actions: [
        {
          label: '不再提示',
          color: 'white',
          handler: () => {
            LocalStorage.set('storage-persistence-tip-shown', true)
          },
        },
      ],
    })
  }
}

export default boot(async ({ app }) => {
  console.log('[Storage] Initializing storage monitoring...')
  
  // 1. 请求持久化存储
  const isPersisted = await requestPersistence()
  
  // 2. 检查当前持久化状态
  const currentStatus = await checkPersistenceStatus()
  
  // 3. 显示持久化状态
  showPersistenceInfo(currentStatus)
  
  // 4. 检查存储使用情况
  const storageInfo = await checkStorageUsage()
  
  if (storageInfo) {
    console.log(`[Storage] Usage: ${storageInfo.usage}MB / ${storageInfo.quota}MB (${storageInfo.percent}%)`)
    
    // 存储警告
    if (storageInfo.usage > STORAGE_DANGER_MB) {
      showStorageWarning(storageInfo.usage, true)
    } else if (storageInfo.usage > STORAGE_WARNING_MB) {
      showStorageWarning(storageInfo.usage, false)
    }
  }
  
  // 5. 提供全局访问
  app.config.globalProperties.$storageInfo = storageInfo
  app.config.globalProperties.$isStoragePersisted = currentStatus
  
  // 6. 定期检查存储状态（每5分钟）
  setInterval(async () => {
    const info = await checkStorageUsage()
    if (info && info.usage > STORAGE_WARNING_MB && !warningShown) {
      showStorageWarning(info.usage, info.usage > STORAGE_DANGER_MB)
    }
  }, 5 * 60 * 1000)
})

// 导出工具函数供其他模块使用
export {
  checkStorageUsage,
  requestPersistence,
  checkPersistenceStatus,
}
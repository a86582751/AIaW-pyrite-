/**
 * 存储监控 Boot Module
 *
 * 在应用启动时：
 * 1. 请求持久化存储（防止浏览器清理IndexedDB）
 * 2. 检查存储使用情况
 * 3. 显示警告（如果存储空间不足）
 * 4. 检查是否需要备份提醒
 */

import { boot } from 'quasar/wrappers'
import { LocalStorage, Notify } from 'quasar'
import {
  getStorageUsage,
  requestPersistence,
  checkPersistence,
  needsBackupReminder,
  getDatabaseStats
} from 'src/utils/storage-manager'

// 是否已经显示过存储警告
let storageWarningShown = false

/**
 * 显示存储警告
 */
function showStorageWarning(usageMB: number, isDanger: boolean) {
  if (storageWarningShown) return
  storageWarningShown = true

  const message = isDanger
    ? `存储空间使用已达 ${usageMB}MB，建议立即导出备份，否则可能导致数据丢失！`
    : `存储空间使用已达 ${usageMB}MB，建议定期导出备份。`

  Notify.create({
    message,
    color: isDanger ? 'negative' : 'warning',
    textColor: 'white',
    icon: isDanger ? 'warning' : 'info',
    timeout: 15000,
    position: 'top',
    actions: [
      {
        label: '知道了',
        color: 'white'
      }
    ]
  })
}

/**
 * 显示备份提醒
 */
function showBackupReminder() {
  Notify.create({
    message: '您已经有一段时间没有备份数据了。建议使用"导出数据"功能备份您的聊天记录。',
    color: 'info',
    textColor: 'white',
    icon: 'cloud_download',
    timeout: 10000,
    position: 'bottom',
    actions: [
      {
        label: '不再提醒',
        color: 'white',
        handler: () => {
          LocalStorage.set('aiaw-backup-reminder-dismissed', true)
        }
      },
      {
        label: '知道了',
        color: 'white'
      }
    ]
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
          }
        }
      ]
    })
  }
}

export default boot(async ({ app }) => {
  console.log('[Storage] Initializing storage monitoring...')

  // 1. 请求持久化存储
  await requestPersistence()

  // 2. 检查当前持久化状态
  const isPersisted = await checkPersistence()

  // 3. 显示持久化状态
  showPersistenceInfo(isPersisted)

  // 4. 检查存储使用情况
  const storageInfo = await getStorageUsage()

  if (storageInfo) {
    console.log(`[Storage] Usage: ${storageInfo.usage}MB / ${storageInfo.quota}MB (${storageInfo.percent}%)`)

    // 存储警告
    if (storageInfo.isDanger) {
      showStorageWarning(storageInfo.usage, true)
    } else if (storageInfo.isWarning) {
      showStorageWarning(storageInfo.usage, false)
    }
  }

  // 5. 检查备份提醒
  if (needsBackupReminder()) {
    // 延迟显示，避免和持久化提示冲突
    setTimeout(() => {
      showBackupReminder()
    }, 5000)
  }

  // 6. 获取数据库统计信息
  const stats = await getDatabaseStats()
  console.log('[Storage] Database stats:', stats)

  // 7. 提供全局访问
  app.config.globalProperties.$storageInfo = storageInfo
  app.config.globalProperties.$isStoragePersisted = isPersisted
  app.config.globalProperties.$dbStats = stats

  // 8. 定期检查存储状态（每5分钟）
  setInterval(async () => {
    const info = await getStorageUsage()
    if (info && info.isWarning && !storageWarningShown) {
      showStorageWarning(info.usage, info.isDanger)
    }
  }, 5 * 60 * 1000)
})

// 导出工具函数供其他模块使用
export {
  getStorageUsage,
  requestPersistence,
  checkPersistence
}

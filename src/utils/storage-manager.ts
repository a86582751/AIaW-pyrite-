/**
 * 存储管理模块 - AIaW Pyrite Version
 *
 * 功能：
 * 1. 自动备份提醒
 * 2. 数据导出增强
 * 3. 存储状态持久化
 * 4. 数据恢复支持
 */

import { LocalStorage } from 'quasar'
import { db } from './db'
import { exportDB } from 'dexie-export-import'

// 存储管理配置
export const StorageConfig = {
  // 自动备份提醒间隔（天）
  backupReminderDays: 7,
  // 存储警告阈值（MB）
  warningThresholdMB: 100,
  // 存储危险阈值（MB）
  dangerThresholdMB: 200,
  // 最大备份数量
  maxBackupCount: 5,
  // 备份存储键
  backupMetaKey: 'aiaw-backup-meta',
  // 最后备份时间键
  lastBackupKey: 'aiaw-last-backup-time',
  // 备份提醒关闭键
  backupReminderDismissedKey: 'aiaw-backup-reminder-dismissed'
}

// 备份元数据
interface BackupMeta {
  timestamp: number
  size: number
  name: string
  workspaceCount: number
  dialogCount: number
  messageCount: number
}

/**
 * 获取存储使用情况
 */
export async function getStorageUsage(): Promise<{
  usage: number
  quota: number
  percent: number
  isWarning: boolean
  isDanger: boolean
} | null> {
  if (!navigator.storage?.estimate) {
    return null
  }

  try {
    const estimate = await navigator.storage.estimate()
    const usage = Math.round((estimate.usage || 0) / 1024 / 1024)
    const quota = Math.round((estimate.quota || 0) / 1024 / 1024)
    const percent = quota > 0 ? Math.round((usage / quota) * 100) : 0

    return {
      usage,
      quota,
      percent,
      isWarning: usage > StorageConfig.warningThresholdMB,
      isDanger: usage > StorageConfig.dangerThresholdMB
    }
  } catch (e) {
    console.error('[StorageManager] Failed to get storage usage:', e)
    return null
  }
}

/**
 * 请求持久化存储
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    return false
  }

  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/**
 * 检查持久化状态
 */
export async function checkPersistence(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false

  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}

/**
 * 获取数据库统计信息
 */
export async function getDatabaseStats(): Promise<{
  workspaceCount: number
  dialogCount: number
  messageCount: number
  assistantCount: number
  artifactCount: number
}> {
  try {
    const [workspaceCount, dialogCount, messageCount, assistantCount, artifactCount] = await Promise.all([
      db.workspaces.count(),
      db.dialogs.count(),
      db.messages.count(),
      db.assistants.count(),
      db.artifacts.count()
    ])

    return {
      workspaceCount,
      dialogCount,
      messageCount,
      assistantCount,
      artifactCount
    }
  } catch (e) {
    console.error('[StorageManager] Failed to get database stats:', e)
    return {
      workspaceCount: 0,
      dialogCount: 0,
      messageCount: 0,
      assistantCount: 0,
      artifactCount: 0
    }
  }
}

/**
 * 导出数据到Blob
 */
export async function exportDataToBlob(options?: {
  removeUserMark?: boolean
}): Promise<Blob> {
  const exportOptions = options?.removeUserMark
    ? {
        filter: (table: string) => ['workspaces', 'dialogs', 'messages', 'assistants', 'artifacts', 'items', 'installedPluginsV2', 'providers'].includes(table),
        transform: (_table: string, value: any) => ({
          value: {
            ...value,
            owner: 'unauthorized',
            realmId: 'unauthorized'
          }
        })
      }
    : {}

  return await exportDB(db, exportOptions)
}

/**
 * 保存备份元数据
 */
export function saveBackupMeta(meta: BackupMeta): void {
  const metas = getBackupMetas()
  metas.push(meta)

  // 保留最新的N个备份
  while (metas.length > StorageConfig.maxBackupCount) {
    metas.shift()
  }

  LocalStorage.set(StorageConfig.backupMetaKey, metas)
  LocalStorage.set(StorageConfig.lastBackupKey, Date.now())
}

/**
 * 获取备份元数据列表
 */
export function getBackupMetas(): BackupMeta[] {
  return LocalStorage.getItem(StorageConfig.backupMetaKey) || []
}

/**
 * 获取上次备份时间
 */
export function getLastBackupTime(): number | null {
  return LocalStorage.getItem(StorageConfig.lastBackupKey)
}

/**
 * 检查是否需要备份提醒
 */
export function needsBackupReminder(): boolean {
  // 如果用户关闭了提醒
  if (LocalStorage.getItem(StorageConfig.backupReminderDismissedKey)) {
    return false
  }

  const lastBackup = getLastBackupTime()
  if (!lastBackup) {
    // 从未备份过
    return true
  }

  const daysSinceBackup = (Date.now() - lastBackup) / (1000 * 60 * 60 * 24)
  return daysSinceBackup >= StorageConfig.backupReminderDays
}

/**
 * 关闭备份提醒
 */
export function dismissBackupReminder(): void {
  LocalStorage.set(StorageConfig.backupReminderDismissedKey, true)
}

/**
 * 重新启用备份提醒
 */
export function enableBackupReminder(): void {
  LocalStorage.remove(StorageConfig.backupReminderDismissedKey)
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/**
 * 格式化日期时间
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

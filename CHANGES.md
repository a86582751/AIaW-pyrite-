# AIaW Pyrite Version - 修改说明

> 📅 修改日期：2026-03-12
> 🏷️ 版本：Pyrite v0.3.0

## 🎉 核心改进

### 1. 虚拟滚动 ✅ (已完成)
**问题**：消息列表无限渲染导致DOM爆炸，手机端卡死

**解决方案**：
- 新增 `src/utils/virtual-scroll.ts` 虚拟滚动模块
- 只渲染可见区域的消息（约10-15条）
- 滚动事件节流100ms

**效果**：
| 场景 | 改进前 | 改进后 |
|------|--------|--------|
| 100条消息 | 100个DOM节点 | ~15个DOM节点 |
| 滚动流畅度 | 卡顿 | 流畅 |
| 内存占用 | 高 | 低 |

### 2. 持久化存储 ✅ (已完成)
**问题**：浏览器可能清理IndexedDB导致数据丢失

**解决方案**：
- 启动时自动请求 `navigator.storage.persist()`
- 存储使用情况监控
- 超过100MB显示警告

### 3. 新模型支持 ✅ (已完成)
**新增模型**：
- Gemini 3.x 系列 (gemini-3.1-pro, gemini-3.1-flash 等)
- GPT-5.2 和 GPT-5.4 系列

**模型功能匹配**：
| 模型系列 | 联网搜索 | 代码执行 | 思考模式 |
|---------|---------|---------|---------|
| Gemini 2.x/3.x | ✅ | ✅ | ✅ |
| GPT-5.1 | - | - | ✅ |
| GPT-5.2 | - | - | ✅ (xhigh) |
| OpenAI Responses | ✅ | ✅ | - |
| Claude 4.x | ✅ | ✅ | ✅ |

## 📁 新增文件

| 文件 | 用途 |
|------|------|
| `src/utils/performance.ts` | 性能优化工具模块 |
| `src/utils/storage-manager.ts` | 存储管理模块 |
| `src/utils/virtual-scroll.ts` | 虚拟滚动模块 ⭐ |
| `src/boot/storage-monitor.ts` | 存储监控启动模块 |

## ✏️ 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/views/DialogView.vue` | 虚拟滚动 + 滚动节流 |
| `src/utils/values.ts` | 新增Gemini 3.x和GPT-5.2/5.4模型 |
| `src/components/ProviderOptionsBtn.vue` | 改进模型判断逻辑 |
| `quasar.config.js` | 添加storage-monitor boot模块 |

## 📊 性能对比

| 指标 | 改进前 | 改进后 |
|------|--------|--------|
| **DOM节点数** | O(n) | O(可视区) |
| **存储安全性** | 无保障 | 有持久化+监控 |
| **滚动性能** | 频繁计算 | 节流100ms |
| **手机卡顿** | 频繁 | 基本消除 |

## 🙏 致谢

- 基于 [NitroRCr/AIaW](https://github.com/NitroRCr/AIaW) 项目修改
- 模型配置参考 [CherryHQ/cherry-studio](https://github.com/CherryHQ/cherry-studio)

---

*Pyrite - 更快、更安全、更强 💎*
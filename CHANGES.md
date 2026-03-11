# AIaW Pyrite Version - 修改说明

> 📅 修改日期：2026-03-12
> 🏷️ 版本：Pyrite v0.2.0

## 🎯 解决的问题

### 1. 性能问题 - 手机端卡死
**原因**：消息列表没有虚拟滚动/懒加载，所有消息一次性渲染到DOM

**解决方案**：
- 添加滚动事件节流（100ms），减少滚动时的计算开销
- 创建了 `src/utils/performance.ts` 性能优化模块，为后续添加虚拟滚动做准备

### 2. 数据丢失问题 - 浏览器清理缓存
**原因**：
- 没有请求持久化存储（`navigator.storage.persist()`）
- 没有存储容量监控和警告
- 用户不知道存储空间不足

**解决方案**：
- 新增 `src/boot/storage-monitor.ts` 启动时自动：
  - 请求持久化存储 ✅
  - 检查存储使用情况
  - 存储空间超过100MB时显示警告
  - 每5分钟定期检查存储状态

### 3. 新模型支持
**新增模型**：
- Gemini 3.x 系列 (gemini-3.1-pro, gemini-3.1-flash 等)
- GPT-5.2 和 GPT-5.4 系列

**模型功能匹配**（基于Cherry Studio配置）：
- Gemini 2.x/3.x → 联网搜索、代码执行、思考模式
- GPT-5.1 → 推理摘要、reasoning_effort (none/low/medium/high)
- GPT-5.2 → reasoning_effort (none/low/medium/high/xhigh)
- OpenAI Responses → 联网搜索、代码执行（GPT-5.2/5.4不支持）
- Claude 4.x → 联网搜索、代码执行、扩展思考

## 📁 新增文件

| 文件 | 用途 |
|------|------|
| `src/utils/performance.ts` | 性能优化工具模块 |
| `src/utils/storage-manager.ts` | 存储管理模块 |
| `src/boot/storage-monitor.ts` | 存储监控启动模块 |

## ✏️ 修改文件

| 文件 | 修改内容 |
|------|---------|
| `quasar.config.js` | 添加 `storage-monitor` boot模块 |
| `src/views/DialogView.vue` | 滚动事件节流优化 |
| `src/utils/values.ts` | 新增Gemini 3.x和GPT-5.2/5.4模型 |
| `src/components/ProviderOptionsBtn.vue` | 改进模型判断逻辑 |

## 🔮 后续改进计划

### P0 - 高优先级（未完成）
- [ ] **虚拟滚动** - 解决手机卡顿的根本方案
  - 需要处理消息高度不一致的问题
  - 需要处理滚动到底部的场景（新消息）
  - 需要处理消息树结构（AIaW支持消息分支）
  - 参考：Quasar QVirtualScroll组件

### P1 - 中优先级
- [ ] 自动备份提醒
- [ ] 消息归档功能
- [ ] Markdown渲染缓存

## 📋 虚拟滚动实现方案（草稿）

```vue
<!-- 方案1：使用Quasar内置虚拟滚动 -->
<q-virtual-scroll
  ref="virtualScroll"
  :items="visibleMessages"
  :virtual-scroll-item-size="estimatedItemHeight"
  @virtual-scroll="onVirtualScroll"
>
  <template v-slot="{ item, index }">
    <message-item :message="item" ... />
  </template>
</q-virtual-scroll>
```

**挑战**：
1. 消息高度动态变化 → 需要动态估算
2. 新消息自动滚动 → 需要特殊处理
3. 消息分支导航 → 可能需要重构

## 📊 预期效果

| 指标 | 改进前 | 改进后 |
|------|--------|--------|
| **存储安全性** | 无保障 | 有持久化+监控 |
| **滚动性能** | 每次触发都计算 | 节流100ms |
| **用户感知** | 突然丢失数据 | 提前警告 |
| **模型支持** | 部分最新模型不识别 | 支持最新模型 |

## ⚠️ 已知限制

1. 虚拟滚动尚未实现，大数据量对话仍可能有性能问题
2. 持久化存储需要浏览器支持（大多数现代浏览器支持）
3. 某些浏览器可能拒绝持久化请求

## 🙏 致谢

- 基于 [NitroRCr/AIaW](https://github.com/NitroRCr/AIaW) 项目修改
- 模型配置参考 [CherryHQ/cherry-studio](https://github.com/CherryHQ/cherry-studio)

---

*Pyrite - 愚人金，但至少不会让你丢失数据 💎*
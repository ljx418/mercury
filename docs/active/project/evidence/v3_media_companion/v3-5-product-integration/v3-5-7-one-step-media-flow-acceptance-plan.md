# V3-5-7 侧边栏一键媒体流程验收计划

日期：2026-10-09。固定样本：`https://www.bilibili.com/video/BV1ZpYd66ELP`。验收使用真实 Chrome、真实本机 Runtime 和真实 B站数据。

## 固定门槛

| ID | 用户场景与操作 | 必须结果 |
|---|---|---|
| A01 | 未授权用户在 B站视频页打开侧边栏 | Chat 仅有一个媒体主动作“启用并分析当前视频”，无“刷新状态/连接 Runtime/开始分析”串联按钮 |
| A02 | 点击唯一主动作 | Chrome 权限由该用户手势触发；允许后自动继续，不要求第二次点击 |
| A03 | 已授权用户重新打开侧边栏 | 自动完成 policy refresh、Runtime session、credential lease 和 acquisition start |
| A04 | Runtime 已启动且授权有效 | 不出现 `V3_MEDIA_POLICY_NOT_GRANTED`；UI 进入准备、采集、转写或成功之一 |
| A05 | Runtime 未启动 | 只显示一个“重新尝试”动作及“请启动 Navia 本机伴侣”的可执行说明 |
| A06 | 无字幕且需要浏览器音频 | 只在 eligibility 明确要求时显示 trusted capture 按钮；不伪造自动点击 |
| A07 | 展开“连接与隐私设置” | 可查看授权用途、Runtime 状态并撤销授权；Cookie 名称和值均不可见 |
| A08 | 连续状态更新或 React 重渲染 | 每个页面/授权版本至多自动启动一次，不创建重复任务或租约 |
| A09 | 键盘操作和四视口 | 主动作、折叠设置和必要 fallback 可达，无横向溢出或遮挡，Axe serious/critical=0 |
| A10 | 全量回归 | typecheck、build、Vitest、credential/session/acquisition 相关测试全部通过 |

## 防假绿

- 不以单元 mock 代替 A02-A06 的真实 Chrome 证据。
- 已授权环境没有 Chrome 弹窗是正确结果；验收检查权限事实和自动后续动作，不以“必须弹窗”作为门槛。
- 不通过预写 localStorage、伪造 policy 或直接调用 acquisition API 跳过 UI。
- 真实流程失败时不得降低权限、安全租约、Axe 或数据真实性门槛。


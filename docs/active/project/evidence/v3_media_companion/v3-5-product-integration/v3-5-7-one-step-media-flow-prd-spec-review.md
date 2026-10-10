# V3-5-7 PRD 规格检视

日期：2026-10-09。检视对象：侧边栏媒体授权、Runtime、安全会话与采集启动的用户路径。

## 规格一致性

本轮没有改变 V3 的媒体理解范围，也没有新增 Agent、长期记忆或自动外发能力。实现仍遵循以下单向链路：

`B站页面适配器 -> 用户授权 policy -> 本机 Runtime session -> 任务级 credential lease -> acquisition -> ASR/视觉处理`。

Cookie 仍只在后台与 Runtime 的短期通道中使用；React、公开 evidence、日志和持久化任务记录均不接触 Cookie 值。真实扫描为 0 hit。

## 用户体验覆盖

已达成：

1. 已完成一次授权后，用户展开页内 Navia 即自动进入媒体分析，不再依次操作“刷新授权、连接 Runtime、建立安全会话、开始分析”。
2. 日常 Chat 只呈现处理状态、一个失败重试动作，以及默认折叠的连接与隐私设置。
3. `V3_MEDIA_POLICY_NOT_GRANTED` 不再由可信 B站嵌入式 Navia surface 的 sender 判定错误触发。
4. Runtime 离线、权限缺失等底层 FailureCode 被映射为用户可执行的中文说明，技术码留在诊断区。

未扩大声明：

1. Chrome 的 optional permission 首次确认属于浏览器安全边界；嵌入 iframe 不能被声明为已经稳定完成原生弹窗。
2. `tabCapture` 的 `activeTab` 调用要求不能静默绕过。它仅是字幕和直接媒体都失败后的兜底，不属于正常样本的日常路径。
3. 本轮不声明 V3 全阶段完成，也不声明所有 B站视频都无需 fallback。

## 偏移判断

- PRD 功能偏移：无。
- 架构越权：无。只放宽了“注册门户页面内的 Navia 扩展 iframe”到既有受信 surface 集合，并同时校验扩展 URL、`naviaInPage=1`、sender tab URL 和门户适配器注册状态。
- 虚假验收风险：已通过限定结论消减。A02 与 A09 未完成项保留为 Pending。
- 用户当前阻塞：已关闭。其 profile 已有 B站/Cookie 权限，真实 run 不再出现 policy 错误并自动进入 processing。


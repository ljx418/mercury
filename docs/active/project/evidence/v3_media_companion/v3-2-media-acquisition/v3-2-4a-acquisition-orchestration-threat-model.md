# V3-2-4a Acquisition Orchestration 威胁模型

日期：2026-10-07。状态：`FROZEN FOR IMPLEMENTATION`。

| 威胁 | 级别 | 控制 | 验收 |
|---|---|---|---|
| UI 伪造前三路失败 | Critical | 前两路只由 Runtime execute 写入；第三路绑定新鲜 page context | A03/A07/A08 |
| available 字幕被跳过以强制 capture | Major | available 固定 blocked，禁止提交第三失败 | A06 |
| 错页/错 tab/错 task | Critical | task/source/adapter/page/tab hash 六重绑定 | A02/A09/A12 |
| Cookie/路径进入响应或日志 | Critical | lease 内存化、public DTO allowlist、双层 secret scan | A05/A16 |
| 自动或后台 capture | Critical | isTrusted + userActivation + one-shot grant | A08/A09 |
| 路线并行导致双终态 | Major | coordinator 锁、固定顺序、幂等 execute、exact-one input | A04/A12 |
| 工具漂移或任意执行 | Major | exact path/hash、no config/plugin/update/shell | A04/A15 |
| 页面 identity 变化 | Major | 每次开始重新 collect；identity 变化拒绝旧 task | A02/A12 |
| 取消后继续写入 | Major | cleaning barrier，终态后零写，关闭子进程/流 | A11/A16 |
| B站实现污染通用层 | Major | client 只消费 adapter contract；平台注册显式构建期 registry | A14 |
| action 点击被 Side Panel 默认行为吞掉 | Major | 禁用 `openPanelOnActionClick`，Background 消费 action 后显式打开面板 | A09/A13 |
| 有格式但静音的 PCM 被当成成功 | Major | sink 统计非零采样与峰值；全零返回 `V3_MEDIA_CAPTURE_EMPTY` | A10/A16 |
| Runtime worker 中 `preexec_fn` 导致 native ASR 崩溃 | Major | 单线程 sandbox launcher 先施加 rlimit/affinity/seccomp，再 exec 冻结入口 | A10/A15 |

剩余风险：平台网络与字幕能力会变化，单一真实 run 只能证明该时点路径；因此最终 V3-2-7 仍需 12 页单 run 重验，4a 通过不得扩大为 V3-2 PASS。

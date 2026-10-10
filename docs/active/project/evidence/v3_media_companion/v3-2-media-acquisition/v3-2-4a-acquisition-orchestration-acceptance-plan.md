# V3-2-4a Acquisition Orchestration 验收计划

日期：2026-10-07。状态：`FIXED DENOMINATOR`。全部 A01..A18 必须有结果，不得 N/A。

| ID | 用户场景/操作 | 必须结果 |
|---|---|---|
| A01 | 在非支持页打开 V3 入口 | 不创建 task/lease，不显示 capture |
| A02 | 在当前 B站页点击开始分析 | 读取真实 `MediaPageContext`，taskId 在页面、lease、acquisition 一致 |
| A03 | Runtime 尝试凭据字幕 | 结果来自 `BilibiliMediaAcquirer`，UI 不能提交该路线结果 |
| A04 | 字幕失败后尝试当前分 P 媒体 | 顺序固定；不得并行或跳过 |
| A05 | 任一路成功 | capture 隐藏，公开 input receipt 不含秘密/绝对路径 |
| A06 | 前两路失败且页面字幕 available | 显示 reader 未实现阻塞；不得降级为 capture |
| A07 | 前两路失败且页面字幕 unavailable/restricted/unknown | 第三失败只提交一次，Runtime eligibility 精确为三条 |
| A08 | 未到三条失败时尝试 grant | Runtime 409 fail-closed |
| A09 | 三条失败后真实可信点击 | 创建 30 秒 one-shot grant 并启动同 tab capture |
| A10 | 完成捕获 | 真实 PCM/WAV 经 SenseVoice 产生非空同 task transcript |
| A11 | 取消/导航/关 tab | 轨道、socket、Offscreen、sink、私有音频全部清理 |
| A12 | reload/重复点击/旧 task | 不复用 grant，不重复路线，不跨 task 投影 |
| A13 | Side Panel 与 Workspace | 读取同一 Runtime task；不各自产生第二事实源 |
| A14 | 权限与门户开放性 | manifest 无新增 host；实现不依赖 bvid/cid UI 字段 |
| A15 | 自动回归 | Runtime/Frontend 全量、typecheck、build、扩展加载均通过 |
| A16 | PRD/隐私审计 | 真实 Chrome 证据、secret scan=0、terminal residual=0、Fatal=0/Major=0 |
| A17 | 媒体下载路线完成 | `credentialed_media_asr` 必须创建同 task transcript；仅返回 audio artifact 判 FAIL |
| A18 | 结果可观测 | offscreen -> Background -> 发起页面保留 Runtime transcript receipt；缺失终态 payload 必须 fail-closed |

## 实施验收解释

- A09 的“可信点击”固定为两步：页面按钮只 arm；用户点击 Navia 扩展操作后，Background 在真实 action event 中消费 armed 请求。直接测试调用 controller、DOM 合成点击或 DevTools `evaluate()` 不计通过。
- A10 除 transcript 非空外，必须记录 `capturedMs`、`nonZeroSampleCount`、`peakAbsSample`，三者均大于零；只有 WAV header/字节数不计通过。
- A11 必须同时检查 Offscreen 不活跃、Runtime media 目录为空、Chrome profile 删除、安全 task root 删除。
- A15 固定全量分母为 Runtime pytest、Frontend Vitest、TypeScript typecheck、production build；聚焦测试不可代替全量。

## 真实数据规则

正例必须使用当前真实 B站详情页、真实 Chrome、真实 Runtime、真实授权会话和已冻结 SenseVoice。fixture、直接调用 capture controller、手工注入 route failure、旧 run artifact 或录制响应均不得计 A02..A13。

若当前样本的前置路线成功，则该 run 证明正常主路径但不证明 A09/A10；capture 正例必须使用冻结矩阵中真实触发三路失败的样本，禁止修改生产接口制造失败。

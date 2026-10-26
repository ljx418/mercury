# WP-A corrective handoff

状态：**AWAITING CODEX CHECKPOINT**。

## 纠偏摘要

1. A24 410 被证实为探针毫秒截断，不是产品凭据通道异常。
2. A24 改为读取正确的 `data.input.route`、正确的 `/v1/media/transcripts/{taskId}`，并轮询真实异步终态。
3. 下载器显式持有 HTTPS、allowlist、最多两次 redirect、最多两次 retry 和总 deadline。
4. repair jobs 原子持久化；fresh manager 自动将五个活动阶段收口为 `failed/RUNTIME_RESTARTED` 并清 staging；提交后的完整版本仍可重新验证。
5. 终态不可被晚到 worker 改写。
6. 已绑定 snapshot 的工具缺失/摘要不符严格失败，不再静默变成 capture fallback；失败释放 task lease。
7. Settings 可恢复 active polling、Runtime 在线自动复检，并在旧 ready 可用时展示最新非阻塞 repair failure。

## 冻结材料

只更新 relay v11 中 `services/local-runtime/navia_runtime/app.py` 的 source scope SHA：

`3c306a0113d2c53d18d6bdf353e55c61567bdaad55f75728a6dad551629b77c2`

完整 source authority digest 更新为：

`0e074285ade637bb1a4dbedd05b35623619a6f053ffef7dd00c08209afc7c206`

baseline 50/50、mutations 16/16；40/20 inventory 不变，unlisted emit `{}`。v10 历史证据未修改。

## 下一门禁

Codex 只需执行一次 WP-A checkpoint：核对 24/24、v11 50/50 + 16/16、A23/A24 收据和 cleanup。通过后才能宣布 WP-A PASS 并回到后续 R6/R7 路线；不需要重复外部文档审查。


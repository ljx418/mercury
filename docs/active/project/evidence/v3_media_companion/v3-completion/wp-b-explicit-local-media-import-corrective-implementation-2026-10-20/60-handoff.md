# WP-B 纠偏 Handoff（2026-10-20）

状态：**WP-B CORRECTIVE NO-GO**

## 1. 关闭了什么

| 计划 | 发现 | 取证 |
|---|---|---|
| **C2** | **Fatal 1** | `tests/test_wp_b_c2_streaming_put.py` **3/3**：真实 ASGI PUT 成功；>1 MiB 传输块被接受；writer 切片全部 ≤1 MiB；durable 字节数/摘要真实；中途失败不留 live session、不泄漏异常 |
| **C1** | **Major 4** | 冻结 `schemaVersion`（公开 `v3-media-local-import/v1` / 存储 `v3-media-local-import-store/v1`）、`media_import_<32 hex>`、公开派生 `recoverable`/`media`；存储回到冻结 15 列。37/37 定向测试通过 |

顺带修正的真实缺陷：store 从未记录上传进度（`uploadedBytes` 恒 0）。

## 2. 仍未关闭（1 Fatal + 5 Major）

C4/Fatal 2 生产编排未接线 · C6/Major 1 浏览器可达性 · C5/Major 2 消费者终态持久化与
真实 coordinator API · C5/Major 3 启动恢复 · C3/Major 5 合格性前置 · C7/Major 6
client abort/polling 与生产组合矩阵。

**这些与 seed 无关**，不得被记为 seed 限制。

## 3. 外部输入阻塞

B29 / B30 需要 registry 合规的 ≥30,000 ms 真实语音动态帧资产。本机真实语音合计 12,290 ms。
`sparse / truncate / 尾部填零 / metadata-only / mock` 全被禁止。

## 4. B01–B30

本轮**未重新证明任何 B 用例**。上一轮 25/30 已被 checkpoint 以 false-green 驳回，不予沿用。

## 5. relay v11（仅报告）

`unlistedBoundaryEmits = {}`、target **20/20** 不变、source 35/40（`app.py`/`coordinator.py`
摘要不符导致抽取器跳过该文件）。**未自重冻结**，按门禁交 Codex 一次性裁决。

## 6. 清洁

owned 资源全 **0**；pytest scratch 已删；未播放声音；未启动可见 Chrome；未 commit/push/reset/
clean/checkout/revert；HEAD 未变；dirty worktree 与历史证据完整。

## 7. 下一轮需要什么

1. 关闭 C3–C7 的 1 Fatal + 5 Major（生产编排与 Extension 面是主体）；
2. 一段 ≥30 秒、含真实语音、含动态帧的私有资产以关闭 B29/B30；
3. Codex 对 `app.py` / `coordinator.py` 的一次性重冻结裁决。

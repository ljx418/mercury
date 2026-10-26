# WP-B 纠偏实施收据（2026-10-20）

候选：`wp-b-explicit-local-media-import-corrective-implementation-2026-10-20`
门禁：`WP-B NO-GO / CORRECTIVE IMPLEMENTATION MAY START`
状态：**WP-B CORRECTIVE NO-GO**

## 0. 停止原因

本纠偏批次**未能关闭全部实现缺陷**：Codex checkpoint 的 **2 Fatal + 6 Major** 中，本轮关闭
**2 项**（Fatal 1、Major 4），**仍有 1 Fatal + 5 Major 未关闭**（Fatal 2 生产编排未接线；
Major 1/2/3/5/6 未关闭）。因此不满足 `WP-B CORRECTIVE AWAITING CODEX CHECKPOINT` 的
前提「全部实现发现已关闭」，按门禁写 NO-GO。

**这不是 seed 缺失导致的**：seed 只影响 B29/B30（外部输入），而上述 6 项实现缺陷与 seed 无关，
不得被记为 seed 限制。

## 1. 本轮关闭的实现缺陷

| 计划 | 发现 | 缺陷 | 证据 |
|---|---|---|---|
| **C2** | **Fatal 1** | PUT 处理器 `await` 了同步的 `begin_stream()`，且用同步 `for` 迭代异步生成器 `request.stream()`——**每次真实上传都在 writer 创建后失败**，并可能留下打开的 writer/session | `tests/test_wp_b_c2_streaming_put.py` **3/3**：真实 ASGI PUT 成功；>1 MiB 传输块被接受；writer 切片全部 ≤1 MiB 且累计等于 body；durable 记录写入真实字节数与摘要；中途失败不泄漏异常、不留 live session |
| **C1** | **Major 4** | 公开/内部记录不符合三个冻结 schema：`schemaVersion` 错、importId 前缀错、缺 `recoverable` 与 `media`；且我一度把 `recoverable`/`prepared_media` 误加进**存储表**（违反冻结 storeRecord） | 改为 `v3-media-local-import/v1` + `v3-media-local-import-store/v1`、`media_import_<32 hex>`、公开派生 `recoverable`/`media`；存储回到冻结 **15 列**（+ `schemaVersion` 字面量 = 16 字段）；37/37 定向测试通过 |

**修复过程中还发现并修正的真实缺陷**：store 从未记录上传进度，`uploadedBytes` 恒为 0
（UI 无法显示真实进度、durable 状态错误）——现由 `finish()`→`complete()` 携带真实字节数与摘要。

## 2. 仍未关闭的实现缺陷（1 Fatal + 5 Major）

| 计划 | 发现 | 缺陷 | 状态 |
|---|---|---|---|
| **C4** | **Fatal 2** | 生产 Runtime **从未**编排 preparer、T1–T4 barrier、transcript task 或 product materializer；B21/B22 在结构上与生产脱节 | **OPEN** |
| C6 | Major 1 | OPTIONS 缺精确 `Access-Control-Allow-Origin`；XHR 用相对扩展 URL 且无 Runtime bearer；`LocalMediaImportCard` 未挂载到生产 eligible-blocked 面 | OPEN |
| C5 | Major 2 | 消费者终态仍是进程内；audio owner receipt 被丢弃；barrier cleanup 调用了签名不兼容/不存在的方法 | OPEN |
| C5 | Major 3 | 启动期未做 import reconciliation；恢复仍可能在 T3/audio staging 之前删除共享输入 | OPEN |
| C3 | Major 5 | POST create 在证明 task/source 为合格 blocked acquisition 之前就分配了 import 记录与配额 | OPEN |
| C7 | Major 6 | client abort / polling 与 C2 之外的生产组合矩阵尚未生产驱动 | OPEN |

## 3. 外部输入阻塞（与实现缺陷严格区分）

| 用例 | 需求 | 状态 |
|---|---|---|
| B29 | registry 合规 100 MB 真实资产 | **EXTERNAL_INPUT_BLOCKER** |
| B30 | registry 合规 ~1 GiB 真实资产 | **EXTERNAL_INPUT_BLOCKER** |

本机全部真实语音合计 **12,290 ms**，低于冻结 **30,000 ms** 下限；sparse / truncate / 尾部填零 /
metadata-only / mock 均被禁止。

## 4. 命令与退出码

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `pytest tests/test_wp_b_c2_streaming_put.py` | **0** | **3 passed** |
| `pytest tests/test_v3_media_local_import_contracts_store.py tests/test_v3_media_local_import_manager.py tests/test_wp_b_c2_streaming_put.py` | **0** | **37 passed** |
| `pytest -k "media or capture or transcript or asr or import or local_import or wp_b"` | **0** | **563 passed** / 469 deselected |
| `npm run typecheck` | **0** | PASS，0 error |
| `npm run build` | 1 → **0** | 首次 ENOMEM（无关的 `financial-asset-manager` 进程占 4 GB），重试 **PASS**，Σ 4.67 MB |
| v11 contract verifier | 2 | 46/50；`unlistedBoundaryEmits = {}`；target **20/20**；source 35/40（摘要级联，见 §5） |

## 5. relay v11 状态（仅报告，不自重冻结）

授权编辑期间源哈希漂移是预期的。`unlistedBoundaryEmits = {}`、target inventory **20/20** 不变，
source inventory 显示 35/40——缺的是 `app.py` / `coordinator.py` 自身发出的码（抽取器跳过摘要
不符的文件）。**未自重冻结**，按门禁交 Codex 一次性裁决。

## 6. 严重度

| 级别 | 数量 | 说明 |
|---|---:|---|
| Fatal | **1** | Fatal 2：生产编排未接线 |
| Major | **5** | Major 1/2/3/5/6 |
| Minor | 0 | — |

## 7. 清洁

owned Runtime 进程 **0**、端口 **0**、Chrome **0**、profile **0**、临时根 **0**；pytest scratch 已删；
未播放声音；未启动可见 Chrome；未 commit/push/reset/clean/checkout/revert；HEAD 未变；
dirty worktree 与历史证据完整保留。

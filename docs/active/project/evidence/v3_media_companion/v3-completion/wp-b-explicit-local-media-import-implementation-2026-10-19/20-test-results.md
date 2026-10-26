# WP-B 测试结果

候选：`wp-b-explicit-local-media-import-implementation-2026-10-19`
状态：**WP-B AWAITING CODEX CHECKPOINT**

## 1. 门禁（B0）

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `08-verify-document-package.py`（WP-B 包） | 0 | **101 / 101** |
| v11 contract（实施前） | 0 | **50 / 50** |
| v11 mutations（实施前） | 0 | **16 / 16** |

## 2. 集中回归（一次，B8）

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `pytest tests/test_v3_media_local_import_*.py`（7 files） | **0** | **98 passed** |
| `npx vitest run …/LocalMediaImportClient.test.tsx` | **0** | **10 passed** |
| `npx vitest run src/modules/media_companion` | **0** | **488 / 488**（60 files） |
| `pytest -k "transcript or media or capture or asr or import"` | **0** | **560 passed** |
| `npm run typecheck` | **0** | PASS |
| `npm run build` | **0** | Σ 4.67 MB |
| `scripts/v3_media_local_import_wp_b_probe.py --case hard-kill` | **0** | **5 / 5 注入点** |
| v11 contract（实施后） | 2 | **46 / 50** —— 摘要级联，见 receipt §6.1 |
| v11 mutations（实施后） | 1 | `canonical_baseline_not_green`（baseline 46/50）—— 在摘要裁决前无法有意义评估 |

## 3. Runtime WP-B 六个测试文件

| 文件 | 用例 | 通过 |
|---|---|---:|
| `test_v3_media_local_import_contracts_store.py` | B01 合同闭集 / B07 语义变异 / store 往返、CAS、单 task 唯一 active、重启扫描 | 20 |
| `test_v3_media_local_import_manager.py` | B05 token 一次性与不入库 / B11 任意块切片与 SHA / B12 取消 | 14 |
| `test_v3_media_local_import_api.py` | B02 / B04 / B06 / B10 | 25 |
| `test_v3_media_local_import_preparer.py` | B13 / B14 / B15 / B18（真实 ffmpeg 媒体） | 9 |
| `test_v3_media_local_import_barrier.py` | B19 / B20 / B23 / B25 | 7 |
| `test_v3_media_local_import_restart.py` | B24 / B25 / B26 | 13 |
| `test_v3_media_local_import_gates.py` | **B03 / B16 / B28** | 10 |
| **合计** | | **98** |

## 4. Extension

| 文件 | 用例 | 通过 |
|---|---|---:|
| `LocalMediaImportClient.test.tsx` | B27 客户端/卡片/可访问性 | 10 |

## 5. 真实 hard-kill probe（B23 / B26）

见 `10-receipt.md` §3。五个生产可达注入点，kill rc 均为 **137**，恢复均在**新进程**中完成，
第一例因缺 visual receipt 而 `CLEANUP_INCOMPLETE` 并**保留对象**；全部 `productSuccessClaimed=false`。

## 6. B01–B30

**25 PASS / 2 PARTIAL / 1 NOT_STARTED / 2 IMPOSSIBLE**。逐项见 `40-case-results.json`。

PARTIAL：B01（资产 registry 项，缺 seed）、B22（图文产品链路未端到端）。
NOT_STARTED：B21（SenseVoice 投影端到端 —— 本机无 TTS，无法合成真实语音）。
IMPOSSIBLE：B29、B30（缺合格私有 seed）。

## 7. secret / cleanup

见 `50-cleanup-and-secret.json`：secret 命中 **0**；owned 进程/端口/临时根 **0**；
公开证据不含绝对路径、原始媒体或转写全文。

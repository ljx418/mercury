# WP-B 纠偏测试结果（2026-10-20）

状态：**WP-B CORRECTIVE NO-GO**

## 1. 定向测试（实现内循环）

| 文件 | 覆盖 | 结果 |
|---|---|---:|
| `tests/test_wp_b_c2_streaming_put.py` | **C2 / Fatal 1**：真实 ASGI PUT、>1 MiB 传输块、writer ≤1 MiB 切片、真实字节数、中途失败清理 | **3 / 3** |
| `tests/test_v3_media_local_import_contracts_store.py` | **C1 / Major 4**：冻结 schemaVersion、`media_import_` id、公开 `recoverable`/`media`、存储列闭集、sequence CAS、单 active、启动扫描 | 20 / 20 |
| `tests/test_v3_media_local_import_manager.py` | token 一次性、任意块切片、取消 | 14 / 14 |

## 2. 集中回归（一次，候选稳定后）

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `pytest -k "media or capture or transcript or asr or import or local_import or wp_b"` | **0** | **563 passed** / 469 deselected |
| `npm run typecheck` | **0** | PASS |
| `npm run build` | 1 → **0** | ENOMEM（无关进程）→ 重试 PASS，Σ 4.67 MB |
| v11 contract verifier | 2 | 46/50，`unlistedBoundaryEmits = {}`，target 20/20 |

未运行：Extension media 子树全量（预算耗尽）、hard-kill/restart probe 重跑、schema/fixture mutation
verifier、secret/path/raw-media 扫描、cleanup 检查。

## 3. B01–B30

**本纠偏轮未重新证明任何 B 用例。** 上一轮的 25/30 已被 Codex checkpoint 以 false-green 驳回
（核心 API/barrier/hard-kill 测试使用了替代物或弱 oracle），因此**不予沿用**。
详见 `40-case-results.json` 的逐项 closed/open/外部输入分类。

## 4. 已关闭项的 oracle 性质

- **C2**：使用生产路由 `put_local_import_content` + 真实 ASGI request（`Request` scope + `receive`），
  非 TestClient 桩、非直接调用 manager；
- **C1**：直接对冻结 schema 校验生产 `public_status()` 与 store 记录形状，非字符串断言。

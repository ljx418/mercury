# WP-A Handoff（2026-10-19）

候选：`wp-a-media-dependency-readiness-implementation-2026-10-19`
阶段结论：**WP-A NO-GO** —— A24 无法真实证明
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp-a-media-dependency-readiness-implementation-2026-10-19/`

## 0. 需要 Codex 裁决的三项

### 0.1 凭据通道 HTTP 路径异常（Major，阻塞 A24）

产品自身的两段式凭据通道出现自相矛盾的判定：

| 观察 | 结果 |
|---|---|
| `POST /v1/media/credential-channels` | ✅ **201** |
| 通道签发 → 消费间隔 | **0.004 秒** |
| 存储记录 | `status:"issued"`，`expiresAt` 尚余 20 秒 |
| **同一 token 直接 `consume()`** | ✅ **成功** |
| **由 store 直接签发的 token 走 lease 端点** | ✅ **201** |
| **经 HTTP 签发的 token 走同一 lease 端点** | ❌ **410 `V3_MEDIA_CHANNEL_EXPIRED`** |

隔离复现：不经 HTTP 时 `issue()` → `consume()` 正常；进程内经两个端点则 channel 201 → lease 410。

即存储逻辑、直接消费与端点逻辑各自正确，异常**只出现在「通道经 HTTP 端点签发」时**。
未绕过：未改端口、未改 TTL、未预置凭据、未直调 downloader、未伪造任何成功。

### 0.2 `app.py` 冻结摘要漂移（Major）

A2/A4 按计划必须修改 `navia_runtime/app.py`：

| | 值 |
|---|---|
| v11 冻结值 | `51791f0568eaeeb8e539ddad392c990c877e196021bf92a0c65622ae200d3f0a` |
| 当前值 | `6ab4665a004b064b9c162caa5d43f70b980dbe5c2d743714fe3c743dd3cd65c9` |

v10/v11 因此掉级（45/50、46/50），失败项全部由 `sourceEvidenceHashesCurrent` 派生。
两个 verifier 的 `unlistedBoundaryEmits` 均为 `{}`：**relay 40/20 码宇宙未扩张**，
未改动任何 fixture / schema / FailureCode registry。是否受限重冻结请你裁决。

### 0.3 24 项分母未达成

**18 PASS + 4 PARTIAL + 1 BLOCKED**，固定 24/24 未达成，因此不能提交 checkpoint。
PARTIAL 四项：A13（重定向阶梯未逐跳穷举）、A17（五个注入点未逐点驱动）、
A20（任务中途篡改未端到端驱动）、A22（重进 Settings 与「旧 ready + 新失败」未端到端驱动）。

## 1. changed files（含 SHA-256）

### 新增 — Runtime 依赖模块

```
services/local-runtime/navia_runtime/modules/media_companion/dependencies/catalog.py
  b171526ea7ddce255d11437303bf0323d013642d465381f7f09e4f7f1f1f8269
services/local-runtime/navia_runtime/modules/media_companion/dependencies/contracts.py
  6d9373a00d6762d79e1d41b90c3064dbb2f459a89cea7cf8270c0fe1d4e13f7b
services/local-runtime/navia_runtime/modules/media_companion/dependencies/manager.py
  7972f1f92513bef32af8baa53fd4a0997d45db431543437b38eb70c588c76f0d
services/local-runtime/navia_runtime/modules/media_companion/dependencies/__init__.py
  a37c2f1aa7158a9722da5a9301e480f43a3a19c97549f7e289a54927c6115409
```

### 新增 — 探针与测试

```
services/local-runtime/scripts/v3_media_dependency_wp_a_probe.py
  f17a370bb94c31b3edf5c03e37990ba0a36fe44c4b5200c2814e402296a799ae
services/local-runtime/tests/test_v3_media_dependency_manager.py
  55fa1580057ecddc953e65f59875f9684eef2225a7266ed4af0868ecd3e4fa84
services/local-runtime/tests/test_v3_media_dependency_api.py
  799ed53fad96e7f9c8a8e4b8afb63b04777b790d68d5f864237ce7b2a7a231f7
services/local-runtime/tests/test_v3_media_dependency_task_binding.py
  21ec8a97947a03020aac2712e9361cd2a657b8bcf1a11992f390b9b098aa2731
services/local-runtime/tests/test_v3_media_dependency_repair_matrix.py
  8e857939b220c7fbc6c4df3f2141e9037878a56df3f6bdfa6d1e9fa77b82b713
apps/chrome-extension/src/modules/media_companion/tests/MediaDependencyRuntimeClient.test.ts
  36840afca66351d5219d60060982c1aee1d9963ea3a3d70180ab1dd0e0b92561
apps/chrome-extension/src/modules/media_companion/settings/MediaDependencySettingsPanel.test.tsx
  c22ffdd34dc644e5414dadf38519cd49f619e13525ce57b97002527c31c3a37e
```

### 新增 — Extension 生产代码

```
apps/chrome-extension/src/modules/media_companion/MediaDependencyRuntimeClient.ts
  d857cef6604c0a2e34e6e4d41873c28a3ea2777c8fd242c5363e593ba56d6a5d
apps/chrome-extension/src/modules/media_companion/settings/MediaDependencySettingsPanel.tsx
  4acf119a3f33ba9921bbd2ae95403bc14b75d7d70817172d3e3440aa62dc5eb3
```

### 修改 — 既有生产文件

```
services/local-runtime/navia_runtime/app.py                                   （计划要求：构造 manager + 四个 API + 三路径接线）
services/local-runtime/navia_runtime/modules/media_companion/product_materializer.py （视觉 downloader 改为按 task snapshot 解析）
services/local-runtime/tests/test_v3_media_acquisition_core.py                （内部缝 `build_media_acquirers` 现接收 snapshot）
```

## 2. 合同变化

- **公共合同：none。** 新增 dependency API 是 WP-A 自带的版本化 loopback 合同
  （三个 `v3_media_dependency_*_v1.schema.json`）。
- **未改动**：media acquisition 请求/响应、SourceAuthority、Cookie 租约、Provider、
  relay v11、既有媒体 FailureCode registry。
- **内部变化**：依赖 owner 从「进程级固定实例」改为「按 task snapshot 解析」。

## 3. 全部命令与退出码

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `08-verify-document-package.py` | **0** | **42/42** |
| `pytest` 四个 WP-A 测试文件 | **0** | **60 passed** |
| `pytest -k "media_dependency or yt_dlp or sensevoice or media_acquisition"` | **0** | **136 passed** |
| `pytest -k "media or capture or transcript or asr"` | **0** | **420 passed** |
| `vitest` 两个新 Extension 测试 | **0** | **12/12** |
| `vitest run src/modules/media_companion` | **0** | **475/475**（59 files） |
| `npm run typecheck` | **0** | PASS |
| `npm run build` | **0** | Σ 4.67 MB |
| `probe --case a23` | **0** | **通过** |
| `probe --case a24` | **1** | **阻塞** |
| v11 / v10 contract verifier | 2 | 46/50、45/50（`app.py` 摘要级联） |

## 4. 真实 run / task / 身份

| 项 | 值 |
|---|---|
| A23 managed root | 本轮 fresh owned 临时根，结束后已删除 |
| A23 下载 | `3,072,469` bytes，SHA-256 `1fa6733c…d4d6`，自检 `2026.08.19` |
| A24 样本 | `BV1Bb411w741 / CID 61744125 / p1` |
| A24 taskId | `media_task_` + sha256(`portal:bilibili:BV1Bb411w741:61744125:p1`) 前 32 位 |
| A24 凭据 | 既有 `NAVIA_V3_BILIBILI_COOKIE_FILE`，**仅路径引用**；9 个冻结 cookie 名含 SESSDATA |
| A24 租户 | channel 201 / lease 410 → 未进入 acquisition |
| Chrome / 可见浏览器 | **0**（本轮未使用） |
| 云 Provider / 声音 / 上传帧 | **0 / 0 / 0** |

## 5. secret / cleanup

见 `50-cleanup-and-secret.json`：secret 命中 **0**；公开证据中 Cookie/API key/token/
原始媒体/转写全文/绝对私有路径均为 **0**；owned Runtime **0**、owned Chrome **0**、
probe 根 **0**、端口 17861/17862 空闲；HEAD 未变；未 commit/push/reset/clean/checkout/revert。

## 6. 剩余风险

| # | 风险 | 等级 |
|---:|---|---|
| 1 | 凭据通道 HTTP 路径异常使 A24 无法证明 | **高** |
| 2 | `app.py` 冻结摘要未重冻结，v10/v11 掉级 | **高** |
| 3 | 四项 PARTIAL 未穷举到验收要求的粒度 | 中 |
| 4 | 未使用真实 Chrome 验证 Settings 面板在浏览器中的真实渲染 | 低（面板有 6/6 组件测试） |

## 7. 交接检查项

| 项 | 状态 |
|---|---|
| changed files 及 SHA | ✅ §1 |
| 合同变化 | ✅ 公共 none |
| 命令 / 退出码 | ✅ §3 |
| A01–A24 | ✅ `40-case-results.json` |
| PRD review | ✅ `30-prd-review.md` |
| secret / cleanup | ✅ `50-cleanup-and-secret.json` |
| 真实 task/run id | ✅ §4 |
| 风险分级 | ✅ §6 |
| Fatal / Major / Minor | **0 / 2 / 0** |

## 8. 自动化停止原因

1. **A24 无法真实证明** —— WP-A 停止条件明文要求此时写 NO-GO 并停止；
2. **固定 24/24 分母未达成**（18 PASS + 4 PARTIAL + 1 BLOCKED）；
3. **两个 Major 未关闭**：凭据通道异常、`app.py` 摘要待重冻结。

状态写为 **WP-A NO-GO**。未宣布 WP-A PASS，未进入 R6/R7，未做独立文档外审或阶段 closeout。

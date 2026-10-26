# WP-A 测试结果（2026-10-19）

候选：`wp-a-media-dependency-readiness-implementation-2026-10-19`
状态：**WP-A NO-GO**

## 1. 分层执行记录

| 层 | 次数 |
|---|---:|
| 实现内循环（仅受影响测试） | 多次 |
| 集中回归（04 计划的固定命令） | **1** |

## 2. 固定命令与退出码

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `python3 -B …-preimplementation-2026-10-19/08-verify-document-package.py` | **0** | **42 / 42** |
| `pytest -q tests/test_v3_media_dependency_{manager,api,task_binding,repair_matrix}.py` | **0** | **60 passed** |
| `pytest -q -k "media_dependency or yt_dlp or sensevoice or media_acquisition"` | **0** | **136 passed** / 782 deselected |
| `pytest -q -k "media or capture or transcript or asr"`（Runtime focused） | **0** | **420 passed** / 481 deselected |
| `npx vitest run …/MediaDependencySettingsPanel.test.tsx …/MediaDependencyRuntimeClient.test.ts` | **0** | **12 / 12** |
| `npx vitest run src/modules/media_companion` | **0** | **475 / 475**（59 files） |
| `npm run typecheck` | **0** | PASS |
| `npm run build` | **0** | Σ **4.67 MB** |
| `python3 -B …/v3_media_dependency_wp_a_probe.py --case a23` | **0** | **通过** |
| `python3 -B …/v3_media_dependency_wp_a_probe.py --case a24 --cookie-file …` | **1** | **阻塞** |

## 3. v10 / v11 relay 门禁

| verifier | 结果 | 说明 |
|---|---|---|
| v11 contract | **46 / 50** | 失败项全部由 `sourceEvidenceHashesCurrent` 派生 |
| v10 contract | **45 / 50** | 同上 |
| v11 `unlistedBoundaryEmits` | **`{}`** | relay 40/20 码宇宙**未扩张** |
| v10 `unlistedBoundaryEmits` | **`{}`** | 同上 |

`app.py` 摘要漂移（计划要求修改该文件）：

| | 值 |
|---|---|
| v11 冻结值 | `51791f0568eaeeb8e539ddad392c990c877e196021bf92a0c65622ae200d3f0a` |
| 当前值 | `6ab4665a004b064b9c162caa5d43f70b980dbe5c2d743714fe3c743dd3cd65c9` |

## 4. A23 真实证明（通过）

| 观察点 | 期望 | 实测 |
|---|---|---|
| 冻结 URL | `…/2026.08.19/yt-dlp` | ✅ 同 |
| 字节数 | `3,072,469` | ✅ `3,072,469` |
| SHA-256 | `1fa6733c…d4d6` | ✅ 精确一致 |
| 固定自检 | exit 0 且 stdout == `2026.08.19` | ✅（终态 `ready` 只在自检通过后到达） |
| 作业阶段 | 六个冻结阶段 | ✅ `sequence=6` |
| staging / probe root | 清零 | ✅ |

## 5. A24 真实证明（阻塞）

| 步骤 | 结果 |
|---|---|
| 凭据解析（九个冻结名，含 SESSDATA） | ✅ 9 |
| bootstrap 认证 | ✅ |
| `POST /v1/media/credential-channels` | ✅ **201** |
| `POST /v1/media/credential-leases` | ❌ **410 `V3_MEDIA_CHANNEL_EXPIRED`** |

矛盾证据：

| 观察 | 结果 |
|---|---|
| 通道签发 → 消费间隔 | **0.004 秒** |
| 存储记录状态 | `issued`，`expiresAt` 尚余 20 秒 |
| 同一 token **直接** `consume()` | ✅ 成功 |
| **store 直接签发**的 token 走同一端点 | ✅ **201** |
| HTTP 签发的 token 走同一端点 | ❌ **410** |

隔离复现：不经 HTTP 时 `issue()` → `consume()` **OK**；进程内经两个端点则 channel 201 → lease 410。

**结论**：存储逻辑、直接消费、端点逻辑各自正确；异常只在「通道经 HTTP 端点签发」时出现。
未绕过（未改端口 / TTL / 未预置凭据 / 未直调 downloader）。

## 6. A01–A24 分母

**24 = 18 PASS + 4 PARTIAL + 1 BLOCKED**；**固定 24/24 未达成**，因此不能提交 checkpoint。
逐项见 `40-case-results.json`。

PARTIAL 四项为：A13（重定向阶梯未逐跳穷举）、A17（五个注入点未逐点驱动）、
A20（任务中途篡改未端到端驱动）、A22（重进 Settings 与旧 ready+新失败未端到端驱动）。

## 7. secret / cleanup

见 `50-cleanup-and-secret.json`。secret 命中 **0**；owned Runtime **0**、owned Chrome **0**、
probe 根 **0**、端口 17861/17862 均空闲；未播放声音；未调用云 Provider。

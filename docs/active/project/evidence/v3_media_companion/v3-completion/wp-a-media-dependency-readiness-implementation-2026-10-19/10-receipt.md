# WP-A 媒体依赖就绪 — 实施收据（2026-10-19）

候选：`wp-a-media-dependency-readiness-implementation-2026-10-19`
门禁：`V3 post-R7 / WP-A / IMPLEMENTATION MAY START`
状态：**WP-A NO-GO**

## 0. 停止原因（一句话）

**A24 无法真实证明**：产品自身的凭据两段式通道在 HTTP 路径上返回一个与实际状态
矛盾的判定——一个约 1 毫秒前签发、存储记录仍为 `status:"issued"`、`expiresAt` 尚有
20 秒未来的通道 token，经 `POST /v1/media/credential-leases` 被判为
`V3_MEDIA_CHANNEL_EXPIRED`（410）；而**同一 token 直接调用 `consume()` 成功**，
**由 store 直接签发的 token 走同一端点返回 201 成功**。

按 WP-A 停止条件「A23/A24 无法真实证明 → 写 WP-A NO-GO 并停止」，本轮在此停止。

**A23 已真实通过。** 其余 A0–A5 全部实现并通过。

## 1. 门禁与基线

| 项 | 结果 |
|---|---|
| 文档包机器 verifier | **42/42 PASS**（exit 0） |
| 本机冻结资产：yt-dlp 2026.08.19 | SHA-256 **精确匹配** `1fa6733c…d4d6`，自检输出 `2026.08.19` |
| 本机冻结资产：ffmpeg / ffprobe | SHA-256 **精确匹配** |
| HEAD | `a303551a5bf89c26ff36b24ac06c7e30c334db27`（`main`，未变） |
| dirty worktree | 保留，未覆盖，未 commit/push/reset/clean/checkout/revert |

## 2. 已完成阶段

| 阶段 | 内容 | 测试 |
|---|---|---:|
| **A0** | 文档合同门禁 | 42/42 |
| **A1** | Runtime `MediaDependencyManager`（catalog / contracts / manager） | **21/21** |
| **A2** | 四个认证 loopback 路由 + 严格 TS 客户端 | **22/22** + **6/6** |
| **A3** | `MediaDependencySettingsPanel` | **6/6** |
| **A4** | 三条生产路径绑定同一 task snapshot | **5/5** |
| **A5** | 修复故障矩阵（A09/A11–A18） | **12/12** |
| **A6/A23** | fresh owned managed root 真实下载冻结资产 | **通过** |
| **A7/A24** | 固定样本真实无声跑通 | **❌ 阻塞** |

Runtime 新增测试合计 **60 passed**（四个文件）。

## 3. A23：真实下载与校验（通过）

`python3 scripts/v3_media_dependency_wp_a_probe.py --case a23` → exit **0**。

| 观察点 | 值 |
|---|---|
| 冻结来源 | `https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp` |
| 期望字节 / 实测字节 | `3,072,469` / **`3,072,469`** ✅ |
| 期望摘要 / 实测摘要 | `1fa6733c…d4d6` / **`1fa6733c…d4d6`** ✅ |
| 固定自检命令 | `--ignore-config --no-plugin-dirs --no-update --no-playlist --simulate --version` |
| 作业终态 | `ready`，`sequence=6`（六个阶段各 +1） |
| staging 清理 | ✅ |
| probe root 删除 | ✅ |

A23 用的是**本次真实下载**到 fresh owned 临时根，不是复用本机已有的 `.navia/tools/yt-dlp`。

## 4. A24：阻塞事实（可复现）

固定样本 `BV1Bb411w741 / CID 61744125 / p1`，凭据来自既有
`NAVIA_V3_BILIBILI_COOKIE_FILE`（路径引用，内容从未读取、打印或写入任何输出）。

| 步骤 | 结果 |
|---|---|
| 凭据解析（九个冻结名，含 SESSDATA） | ✅ 9 条 |
| bootstrap 认证（master token + 精确 origin） | ✅ |
| `POST /v1/media/credential-channels` | ✅ **201** |
| `POST /v1/media/credential-leases` | ❌ **410 `V3_MEDIA_CHANNEL_EXPIRED`** |

### 4.1 矛盾证据

| 观察 | 结果 |
|---|---|
| 通道签发到消费的间隔 | **0.004 秒** |
| 存储记录 | `status:"issued"`，`expiresAt` 仍有 20 秒 |
| **同一 token 直接 `consume()`** | ✅ **成功** |
| **由 store 直接签发的 token 走同一端点** | ✅ **201** |
| 经 HTTP 签发的 token 走同一端点 | ❌ **410** |

隔离复现（不经 HTTP）：`CredentialChannelStore.issue()` → `consume()` → **OK**。
在进程内经 `TestClient` 走两个端点：channel **201** → lease **410**。

即：**存储逻辑正确、直接消费正确、端点正确**；只有在「通道经 HTTP 端点签发」时，
`consume()` 才返回过期判定。

本轮**未绕过**该路径（不改端口、不改 TTL、不预置凭据、不直调 downloader）。

## 5. 需要 Codex 裁决的两项

### 5.1 凭据通道 HTTP 路径异常（Major）

上面的矛盾证据。未修复即无法证明 A24。这是产品侧问题，不是探针问题。

### 5.2 `app.py` 冻结摘要漂移（Major）

A2/A4 按计划必须修改 `navia_runtime/app.py`：

| | 值 |
|---|---|
| v11 冻结值 | `51791f0568eaeeb8e539ddad392c990c877e196021bf92a0c65622ae200d3f0a` |
| 当前值 | `6ab4665a004b064b9c162caa5d43f70b980dbe5c2d743714fe3c743dd3cd65c9` |

v10/v11 因摘要不符掉级（v11 46/50、v10 45/50），失败项全部由
`sourceEvidenceHashesCurrent` 派生。**两个 verifier 的 `unlistedBoundaryEmits` 均为
`{}`**：新码属 `V3_MEDIA_DEPENDENCY_*` 独立 registry，**relay 40/20 码宇宙未扩张**，
也未改动任何 fixture / schema / FailureCode registry。本轮未修改冻结材料。

## 6. 严重度

| 级别 | 数量 | 说明 |
|---|---:|---|
| Fatal | 0 | — |
| **Major** | **2** | ① 凭据通道 HTTP 路径异常，阻塞 A24；② `app.py` 冻结摘要需受限重冻结 |
| Minor | 0 | — |

## 7. 停止点

状态 **WP-A NO-GO**。未宣布 WP-A PASS，未进入 R6/R7，未做独立文档外审或阶段 closeout。

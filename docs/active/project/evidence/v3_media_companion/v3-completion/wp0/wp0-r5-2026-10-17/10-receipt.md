# WP0 R5 Fresh Visible Muted Chrome Canary — Phase Receipt（2026-10-18）

Candidate: `wp0-r5-2026-10-17`
前置：`60-codex-r4-checkpoint.md` 判定 `R4 PASS / R5 MAY START`
授权边界：**仅 R5；R6/R7 不授权**
状态：**R5 NO-GO**

**未启动 canary（配额 0）。未播放声音。未调用云 Provider。未运行六视频。**

## 0. 停止原因（一句话）

R5-0 离线预检**全绿**，模型已就绪并经产品 API 证明为 effective；但 **R5-2 的用户可达
媒体面在本环境不可用**：真实侧边栏里媒体卡片渲染为**空容器**，其主动作
「启用并分析当前视频」在被**可信点击**后不产生任何状态变化，面板持续报
`Page unknown` 与 `Companion Runtime request was rejected.`。按 61 §6「真实路径失败
→ R5 NO-GO，保留失败证据，不重复碰运气」停止。

**没有绕过。** 全程未直接调用 Controller、materialize endpoint、database、store、
grant/transcript/terminal；未伪造 grant、PCM、transcript 或产品结果。

## 1. R5-0 离线预检（全部通过）

| # | 预检项 | 结果 |
|---:|---|---|
| 1 | R4 PASS · R4 证据 manifest | **4 / 4 OK** |
| 1 | v10 baseline / mutations | **50 / 50** exit 0 · **15 / 15** exit 0 |
| 1 | 重冻结 fixture / verifier 摘要 | `a89c8f09d8c27054a49bd9c85bc3475ff70b873f5543174dfeacb01fe4719d74` / `c4dd95d78a7e4dbba24794f3a2342a2557b4d1a0c14574cbd1a37c1d02c55191` —— 与 `60-codex-r4-checkpoint.md` **逐字一致** |
| 2 | typecheck · media 子树 · build · Runtime focused · relay static | exit 0 · **229/229** · exit 0（Σ 4.66 MB）· **247 passed** · **42/42** |
| 3 | 端口 `17861` bind preflight | **空闲**，无 listener，无残留 Runtime |
| 4 | SenseVoice 身份与就绪 | 见 §2 —— **通过** |
| 5 | manifest / unpacked build / 站点权限 / 启动方式 / runner | 见 §3 —— 除媒体面外均就绪 |

## 2. 模型：通过产品 API 证明（61 §2 第 4 项）

来源：owned fresh Runtime（端口 **17861**，fresh database 与 private root），
`GET /v1/asr/catalog` 与 `GET /v1/asr/settings` 均 HTTP **200**。

| 观察点 | 值 | 判定 |
|---|---|---|
| `modelId` | `funasr-sensevoice-small-q8` | ✅ |
| `providerId` | `funasr_edge_local` | ✅ |
| frozen `revision` | `90c1c61912018b70ada0fcc024ea24aca62f2e63` | ✅ |
| `installation.state` | **`ready`** | ✅ |
| `installation.verifiedAt` | `2026-10-17T16:57:53.727286Z` | ✅ self-test 已通过 |
| `effectiveModelId`（`PATCH /v1/asr/settings` 后 `GET` 复核） | **`funasr-sensevoice-small-q8`** | ✅ |
| `fallbackActive` / `fallbackReason` | `false` / `null` | ✅ 无兜底掩盖 |

### 2.1 文件校验（64 §4 冻结值，逐字节一致）

| 文件 | SHA-256 | 冻结值一致 |
|---|---|---|
| `funasr-llamacpp-linux-x64.tar.gz` | `779967de1c528c2be966bcc47f246e7d3e6fcdb748d9491263062f4120f35e52` | ✅ |
| `sensevoice-small-q8.gguf`（下载暂存） | `4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5` | ✅ |
| `fsmn-vad.gguf`（下载暂存） | `1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479` | ✅ |
| `sensevoice-small-q8.gguf`（已安装） | 同上 | ✅ |
| `fsmn-vad.gguf`（已安装） | 同上 | ✅ |
| `llama-funasr-sensevoice`（已解包二进制） | `c41a53b0156f5c6c01a4390aee601831890d2fffe272d34499e1589e64c30edd` | 已记录 |

原生二进制在 WSL2 **执行成功**（`--help` rc=0，支持 `-m / --vad / --backend cpu / --srt`）。

### 2.2 模型与缓存位置（§二 要求）

- 模型：`C:\workspace\navia\.navia\asr\models\funasr-sensevoice-small-q8`（Windows 持久卷）
- 下载暂存：`C:\workspace\navia\.navia\downloads\funasr-sensevoice-small-q8`
- **不在 WSL 虚拟磁盘**（`/tmp` 下无任何模型或 R5 scratch 残留）
- **不在 Git**（`git ls-files --error-unmatch .navia` → 未跟踪）

## 3. 64 文件：安装 UX 最小纠偏（已完成，先补定向测试）

范围严格限定为**内部 UI / 编排**；**未改动**公共 API、catalog、hash、来源白名单或安全边界。

| 缺口（64 §2） | 处置 |
|---|---|
| ① 安装后仍需再点一次「选择」 | 主动作改为一次「下载、安装并使用」；`ready` 后自动写 `requestedModelId`，且**仅当** Runtime 返回 `effectiveModelId=funasr-sensevoice-small-q8` 才显示「已安装并启用」，否则显示「已安装但尚未生效」 |
| ② 提示从 Navia 发布页取 `.navia-asrpack` | **删除该不实说法**。如实说明：导入入口目前只接受 `.navia-asrpack`，Navia 不提供可下载的发布包，须由本机伴侣本地校验并组包 |
| ③ 不披露 Windows 持久目录 | 新增 `asr-windows-storage` 区块，列出三个冻结目录并说明「不在 WSL 虚拟磁盘，WSL 回收/重启/重装都不丢失」 |
| ④ 三个官方文件无法直接导入 | 给出真实可执行的路径：三个冻结文件名 + 暂存目录 + 导入入口格式 + 「hash 后生效」说明 |
| ⑤ 五类失败统一写「安装失败」 | 按真实固定错误码分为 **network / space / hash / self_test / permission / qualification / unknown** 七类，各自给出下一步动作；Runtime 离线时改为提示「启动 Navia 本机伴侣」而非留一个必失败的安装按钮 |

定向测试 **9/9 通过**（6 条新增 + 3 条按主动作变更更新），含「不得出现发布页字样」的断言。

## 4. R5-2 真实 canary：阻塞事实链

### 4.1 已打通的环境能力（全部为本轮 owned）

| 能力 | 状态 |
|---|---|
| owned Windows Chrome（PID 56980）+ CDP 9222（WSL 可连） | ✅ |
| 扩展加载（Chrome 137+ 下 `--load-extension` 已失效，改用 CDP `Extensions.loadUnpacked`） | ✅ id `gcifeacdafknfikkfccniigjdcofpcha` |
| 固定 BVID 真实加载 | ✅ 标题《日本内需死局：试遍全球救市剧本…》 |
| owned Runtime 17861 | ✅ PID 761733 |
| 真实侧边栏 WebContents 经原生 CDP attach | ✅ |
| 视频页成为面板 active tab | ✅ `activeTabUrl = https://www.bilibili.com/video/BV1pohR6rEEh/` |
| 媒体面出现（`media-companion-launch` / `-enable` / `media-connection-settings`） | ✅ |
| **可信点击**（`Input.dispatchMouseEvent`，`isTrusted=true`） | ✅ 已证明有效：Chat→Know 标签切换生效 |
| `execute-action` 原生加速键（owned-PID `keybd_event`） | ✅ 已证明真实派发 `method=owned-pid-execute-action-shortcut` |

### 4.2 阻塞点

| 观察 | 结果 |
|---|---|
| 面板状态行 | 始终 `Runtime online · Page unknown · idle` |
| `media-companion-launch` 容器 `innerText` | **`""`（空容器）** |
| `media-connection-settings` 容器 `innerText` | **`""`（空容器）** |
| 可信点击「启用并分析当前视频」后 10 次轮询（每次 5 s，共 50 s） | **状态零变化**；无原生弹窗；无 Runtime 请求 |
| Know 标签页文案 | `Companion Runtime request was rejected.` |
| `getActiveTabUrl()` 逻辑 | 生产构建下 `__NAVIA_E2E_BRIDGE__` 为 false，`naviaE2ETabId` **被忽略**（`main.tsx:3610-3613`），只能依赖 `chrome.tabs.query({active:true})` |

**结论**：媒体卡片的授权动作在真实侧边栏里不产生任何可观测行为，且卡片本身渲染为空。
这是**产品 UI 在该环境的真实路径失败**，不是自动化能力不足——同一 target 上无关的标签
点击已被证明有效。

## 5. 为什么不绕过

61 §4 明确要求「成功路径直接调用 Controller、materialize endpoint、database、store、
grant/transcript/terminal 的次数必须为 `0`」。本轮全程为 **0**。用直调或伪造绕过空卡片，
会得到一个无法证明「用户可达路径可用」的假 canary，属 §6 的 runner 越权与 false green。

## 6. changed files

### 生产代码（UI / 编排）

```
apps/chrome-extension/src/modules/media_companion/settings/AsrModelSettingsPanel.tsx
  211d3fc8f779d56fa889db3aa382d6660c62257ecf9e99a729d506bbea525fdb
apps/chrome-extension/src/modules/media_companion/settings/AsrModelSettingsPanel.test.tsx
  1310f17ce351038f89e58c383d337b6caf48920dfdfc264d7a0c8f7e1d9eea03
```

### 新增 R5 资产（探针 / canary 驱动器，均未进入生产包）

```
apps/chrome-extension/e2e/lib/rawCdp.mjs
  50a593c14eaf0c9b11e46941c32eb35dbafce527cb4d794ea2ca3553c7f14f49
apps/chrome-extension/e2e/r5-headless-feasibility-probe.mjs
apps/chrome-extension/e2e/r5-accelerator-probe.mjs
apps/chrome-extension/e2e/r5-loadext.mjs
apps/chrome-extension/e2e/r5-canary-stage1.mjs
apps/chrome-extension/e2e/r5-canary-a.mjs … r5-canary-r.mjs
```

### 明确未修改

`services/local-runtime/**` 全部；extension 其余源码；v10 schema / fixture /
20-40 inventory / FailureCode / 阈值 / 公共 API / Origin / ticket TTL /
SourceAuthority / 产品 terminal 定义；R0–R4 全部历史证据目录。

## 7. 合同变化

**none**（公共合同）。内部新增若干纯函数与一次性 UI 编排，不改变任何对外契约。

## 8. 真实 run 计数

| 项 | 次数 |
|---|---:|
| **R5 canary 运行次数** | **0** |
| 可见 Chrome 实例（本轮 owned） | 1（PID 56980，14 个进程，结束时全部终止） |
| 固定 BVID 访问 | 1（仅加载与侦察，未开始分析） |
| **capture 启动 / PCM / ACK** | **0 / 0 / 0** |
| **ASR 推理 / transcript** | **0 / 0** |
| **acquisition / materialize / product terminal** | **0 / 0 / 0** |
| 声音播放 | **0**（全程 `--mute-audio`） |
| 云 Provider 调用 | **0** |
| 六视频 | **0** |
| 站点权限 / tabCapture 原生弹窗 | 0 |
| owned Runtime | 1（PID 761733） |

## 9. 严重度

| 级别 | 数量 |
|---|---:|
| Fatal | 0 |
| Major | **1** — R5-2 用户可达媒体面在真实侧边栏中渲染为空且主动作无响应（真实路径失败） |
| Minor | 0 |

## 10. 停止点

状态 **R5 NO-GO**。未进入 R6，未宣布 R5 PASS，未做独立文档外审或阶段 closeout。

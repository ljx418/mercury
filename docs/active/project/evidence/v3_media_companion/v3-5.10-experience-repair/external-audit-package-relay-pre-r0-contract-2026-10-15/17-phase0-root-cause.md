# Stage B B-5-3 Phase 0 Stage A 7 分钟超时根因定位（2026-10-15）

日期：2026-10-15。本文件定位 `BV1pohR6rEEh`（与所有其他 BVID 共用）
Stage A 7 分钟超时的真实根因，并把修复限制在受现有文档支持的最小范围内。

## 1. 现象

- 最近一次 B-5-3 fresh run `stage-b-b5-3-recovery-20261014T132500Z`：
  - BVID 1 `BV1pohR6rEEh`：Stage A 7 分钟超时，`finalDisposition = "blocked"`，
    `finishReason = "stage_a_timeout_for_bvid_BV1pohR6rEEh: 7 minute window
    exhausted (bilibili access blocked)"`；
  - BVID 2 执行中因交接主动停止；
  - sequencer 未完成，`finishedAtUtc = null`。
- 7 分钟窗口内 BVID 1 的状态：
  - Chrome 启动正常（带 `--mute-audio` / `--load-extension` /
    `--disable-extensions-except` / `--user-data-dir=`）；
  - Runtime 子进程启动正常，`/v1/health` 通过；
  - 页面导航正常；
  - 浮动 launcher 按钮点击成功；
  - 7 分钟内 140 次轮询 `media_tasks` 表全部空 → 最终 disposition=blocked。

## 2. 候选根因（按可能性排序）

### 候选 1（确认 FATAL）— 旧 runner 轮询 SQL 目标表错误

- 文件:行：`scripts/stage_b_b5_3/run_one_bvid.mjs:289-307`（旧版本）
- 内容：runner 通过 `execFileSync("sqlite3", ["-json", dbPath,
  "SELECT task_id,source_identity,state,revision,updated_at FROM media_tasks
  ORDER BY updated_at DESC LIMIT 5"])` 轮询 SQLite `media_tasks` 表。
- 真实写入链路：
  - `POST /v1/media/acquisitions/resolve`
    （`app.py:1121-1142`）→ `media_acquisition_coordinator.resolve()` →
    `MediaAcquisitionCoordinator._create_locked`
    （`coordinator.py:307-324`）→ `MediaTaskStore.reserve_source_authority`
    （`task_store.py:197-231`）→ 写入 **`media_source_authority`** 表；
  - **`media_tasks`** 表只通过 `POST /v1/media/outline-tasks`
    （`app.py:1365-1380`）由 `MediaTaskStore.create()`
    （`task_store.py:355-382`）创建；
  - 扩展代码（`apps/chrome-extension/src/runtimeClient.ts`）**没有**
    `createMediaOutlineTask` / `createOutlineTask` 等 POST 客户端
    （已 grep 验证：`runtimeClient.ts` 仅包含 GET / materialize / cancel /
    retry / ask / exports 等方法）；
- 结论：`media_tasks` 在整个 resolve 流程中**永不**被插入；旧 runner 140
  次轮询命中空 → 7 分钟窗口耗尽 → `finalDisposition = "blocked"` 是 runner
  自身分配的，**与 bilibili 是否真实可达无关**。

### 候选 2（确认 MAJOR）— execFileSync 无 try/catch 保护早成

- 文件:行：`run_one_bvid.mjs:292-294`（旧版本）
- 内容：`execFileSync("sqlite3", ["-json", dbPath, ...])` 无 try/catch；
  任何 sqlite transient error（lock 冲突、Runtime 启动未完成时 `media_tasks`
  表未迁移）会抛到外层 catch block → runner 跳过 7 分钟窗口直接进入 catch；
- 7 分钟窗口实际可能更短；finishReason 错标 "(bilibili access blocked)"。

### 候选 3（确认 MAJOR）— 缺乏可区分真实/模拟 block 的诊断信号

- 文件:行：`run_one_bvid.mjs:310-317`（旧版本）
- 内容：超时路径硬编码 `finalDisposition = "blocked"` + 文案 "（bilibili
  access blocked）"，无任何信号区分真实 bilibili 访问限制 vs runner
  state-machine 缺陷；
- 独立审查代理复算时被诱导为"真实 blocked"。

### 候选 4（确认 MINOR）— Stage B synthesize 端点需要 `media_tasks` 行

- 文件:行：`services/local-runtime/navia_runtime/app.py:1428-1456`
- 内容：`POST /v1/media/tasks/{task_id}/comprehension/synthesize` 调用
  `media_outline_task_store.require_current_authority(task_id)`（`app.py:1434`），
  触发 `MediaTaskStore._require_row(task_id)`（`task_store.py:367-372`） →
  `media_tasks` 表无此 task_id → 抛 `MediaTaskStoreError`；
- 当前扩展流程不创建 `media_tasks` 行；即便 runner 成功轮询
  `media_source_authority`，synthesize 端点仍会失败。

### 候选 5（确认 MINOR）— 扩展不发 `media-companion-enable` 点击

- 文件:行：`apps/chrome-extension/src/modules/media_companion/MediaCompanionLaunchCard.tsx:79`；
  working test：`v3-media-experience-stage-a-fresh.mjs:340-372`
- 内容：扩展的浮动 launcher 按钮点击（`data-testid="navia-floating-launcher"`）
  只打开 sidepanel；真正触发 resolve 流程需要 `media-companion-enable`
  按钮点击 + `chrome.permissions.request({origins: ["https://*.bilibili.com/*"]})`
  native prompt；
- 当前 runner `run_one_bvid.mjs:281-283` 只点 launcher 不点 enable；
  需 X11/Xvfb fake-click native prompt（`v3-media-experience-stage-a-fresh.mjs:343-368`
  ctypes 调 `libX11.so.6` / `libXtst.so.6`）；
- 范围：Phase 1 启动 fresh run 前必须解决；本 Phase 0 不在 runner 范围内
  （避免 X11 fake-click 扩大权限 / 改变隐私边界）。

### 候选 6（已排除）— 真实 bilibili 访问限制

- 评估：不可能在 7 分钟内被证实。
- 理由：扩展不触发 resolve 流程；扩展不发任何 bilibili URL 请求；acquire_input
  / probe_subtitles_with_receipt 等会触发 bilibili HTTP 的代码路径从未
  被调用；
- 因此 "blocked" 文案与 bilibili 真实可达性无关。

## 3. 确认根因

**主要确认 — 候选 1**：runner 轮询错误的 SQLite 表（`media_tasks` 而非
`media_source_authority`），导致 7 分钟超时在所有 BVID 上都是确定性的，与
bilibili 可达性无关。

**次要确认 — 候选 2 + 候选 3**：execFileSync 缺乏 try/catch + 缺乏
runner-state-machine vs 真实-block 区分信号，进一步掩盖真实根因。

**未关闭缺陷（候选 4 + 候选 5）**：本 Phase 0 不在范围内（避免扩大权限 /
改变隐私边界 / 修改 product code / 改变固定分母），留待 Phase 1 启动 fresh
run 前处理：
- 候选 4：runner 调 synthesize 前先 `POST /v1/media/outline-tasks` 创建
  `media_tasks` 行；
- 候选 5：runner 复用 `v3-media-experience-stage-a-fresh.mjs:340-372` 的
  `media-companion-enable` 点击 + X11 ctypes fake-click native prompt。

## 4. 修复（受现有文档支持）

| 修复 | 文件:行 | 受支持文档 |
|---|---|---|
| 轮询目标 `media_tasks` → `media_source_authority` | `run_one_bvid.mjs:289-307` | `task_store.py:197-231` `reserve_source_authority` 是 resolve 唯一写入路径；`v3-media-experience-stage-a-fresh.mjs:578,589-591` working test 已使用 `media_source_authority` 表轮询 |
| execFileSync try/catch | `run_one_bvid.mjs:303-317` | 通用 defensive coding |
| 状态白名单 + 诊断 | `run_one_bvid.mjs:320-321, 350-354` | `task_store.py:217` `state='active'` / `mark_source_authority` `state='published'/'cancelled'/'failed'`；与 `coordinator.py:22` `TERMINAL_STATES` 一致 |
| `expectedRevision: 1` | `run_one_bvid.mjs:374` | `task_store.py:374` `INSERT INTO media_tasks VALUES (?,?, 'created', 1, ...)` 默认 revision=1 |
| 文案替换 | `run_one_bvid.mjs:347-348` | runner state-machine 区分真实/模拟 block，独立审查可复算 |

## 5. 修复点验证（独立审查可复算）

```bash
# (a) 轮询目标
grep -n "FROM media_source_authority" scripts/stage_b_b5_3/run_one_bvid.mjs
# 期望：1 行（修复后）

# (b) execFileSync 保护
grep -n "try {" scripts/stage_b_b5_3/run_one_bvid.mjs
grep -n "catch (pollError)" scripts/stage_b_b5_3/run_one_bvid.mjs
# 期望：≥ 1 行（修复后）

# (c) 诊断文案
grep -n "runner state-machine; real bilibili block unconfirmed" scripts/stage_b_b5_3/run_one_bvid.mjs
# 期望：1 行（修复后）

# (d) expectedRevision=1
grep -n "expectedRevision: 1" scripts/stage_b_b5_3/run_one_bvid.mjs
# 期望：1 行（修复后）
```

## 6. 残余风险（必须在 Phase 1 处理）

1. **synthesize 端点需要 `media_tasks` 行**：候选 4。Phase 1 启动前 runner
   必须先 `POST /v1/media/outline-tasks` 创建 `media_tasks` 行；本 Phase 0
   不在范围内（避免修改 product code）。
2. **chrome.permissions.request native prompt 处理**：候选 5。Phase 1
   启动前 runner 必须复用 `v3-media-experience-stage-a-fresh.mjs:340-372`
   的 X11 ctypes fake-click；本 Phase 0 不在范围内（避免扩大权限 / 改变
   隐私边界）。

## 7. 反向论证（候选 6 = "真实 bilibili 访问限制"）

- 候选 6 已排除；
- 反向论证依据：扩展不触发 resolve 流程 → 不调用 acquire_input →
  不调用 `BilibiliMediaAcquirer.resolve_identity` →
  不调用 `probe_subtitles_with_receipt` → 没有任何 HTTP 请求离开
  Runtime → bilibili 服务端无任何理由返回 403 / region / captcha；
- 因此 "blocked" 文案是 runner 自己分配的，与 bilibili 可达性无关。
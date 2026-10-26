# Stage B B-5-3 Phase 0 详细开发计划（runner 可信化，2026-10-15）

日期：2026-10-15（Codex 独立检视后修订）。本 Phase 0 文件承接
`docs/active/project/handoffs/v3-claudecode-completion-2026-10-15/00..07`
完成阶段交接包 P0（B-5.3 runner 可信化），按
`docs/active/project/design/project-stage-workflow.md §5 实施与逐子阶段验收`
"开始每个子阶段前，依据总 PRD 单独落盘详细开发计划、验收标准、实施前审计和风险清单"
规则落盘。

本 Phase 0 仅执行：
- runner 恢复审计 + 59 项 node test（已完成候选，不构成 PASS）；
- 关闭 Codex 独立检视确认的 6 项 Major 缺陷；
- runner 状态机最小修复 + sequencer 非零失败退出 + outline-task 创建 +
  Chrome 原生权限处理；
- 真实 Runtime API 集成测试 + 1 个固定 BVID 的静音 Chrome canary；
- 落盘 test results / PRD review / handoff，然后停止主干实现，向
  `navia-审查` 提交 immutable candidate。

**不**执行任何真实六视频 fresh run（与 `06-main-development-prompt.md` P0
限定一致）；不 commit / push；不替独立审查作最终 PASS。

## 0. P0 必须关闭的 6 项 Major 缺陷（Codex 独立检视确认）

1. **M-1 状态机矛盾** —— `media_source_authority.state ∈ {"active","published"}`
   被 runner 当作 Stage A 完成态，但下游 synthesize 端点要求 `media_tasks.state ∈ {"ready","degraded"}`；
   旧状态机无对应映射，成功路径不可达。
2. **M-2 未定义变量** —— runner 成功路径引用未定义的 `projections.taskId`
   （曾以 `convergence.taskId` 替代），导致下游 evidence 目录定位与产物
   写盘抛 ReferenceError。
3. **M-3 outline-task 缺失** —— Runtime `comprehension/synthesize` 端点
   (`app.py:1428-1456`) 调用 `media_outline_task_store.require_current_authority(task_id)`，
   该方法在 `task_store.py` 中要求 `media_tasks` 行存在；扩展不调用
   `POST /v1/media/outline-tasks`，runner 未证明该原子步骤。
4. **M-4 启用动作未证明** —— runner 只点击浮动入口 launcher，未点击
   `media-companion-enable` 触发扩展初始化；未处理
   `chrome.permissions.request` native prompt。
5. **M-5 退出码不可信** —— runner catch 块吞掉所有 error 并以非零/抛出
   形式退出，但 sequencer 只看 child `proc.status`（子进程退出码）和
   `final_disposition.txt` 内容；当 runner 异常未写 final_disposition.txt
   时 sequencer 把 disposition 设为 `"failed"` 但 sequencer 自身仍退出 0，
   可能假绿。
6. **M-6 stub 覆盖不足** —— SIGTERM、Runtime crash、service worker 缺失、
   cleanup failure 主要由 stub 覆盖；真实分支未被复算。

6 项均为 P0 出门前必须解决的硬门禁。任何一项遗留 → Phase 0 NO-GO。

## 1. 范围与不扩展

- 范围：
  - 只读审计 `scripts/stage_b_b5_3/run_one_bvid.mjs` 与
    `scripts/stage_b_b5_3/sequencer.mjs` 的 fresh isolation、退出码、
    SIGTERM/异常清理、超时、单 blocked/两个 blocked、secret scan、禁止
    上传计数、Chrome worker 缺失、cleanup fail-closed；
  - 把 runner 中可独立测试的纯逻辑（参数解析、哈希、JSON/文本写入、
    secret 扫描、upload counter 校验、V2.1 receipt 字段校验、
    Chrome 命令行 `--mute-audio` 断言等）抽取到
    `scripts/stage_b_b5_3/lib/contracts.mjs`（既有候选已落盘，不重复）；
  - 既有 59 项 node test（48 contracts + 11 sequencer）作为候选基线；
  - 关闭 §0 列举的 6 项 Major 缺陷：runner 状态机最小修复（`active`/
    `published` 映射到 reconcile-pending，再由 `POST
    /v1/media/outline-tasks` 创建 media_tasks 行升级到 ready/degraded）、
    消除 `projections.taskId` 未定义、sequencer 非零失败退出、Chrome
    `media-companion-enable` 点击 + native permission 处理；
  - 真实 Runtime API 集成测试（启动本地 navia_runtime，POST
    `/v1/media/outline-tasks`、`/v1/media/tasks/<id>/comprehension/synthesize`、
    `/v1/health`）；
  - 1 个固定 BVID 的静音 Chrome canary（受限：若 canary 需要新权限或影响
    用户桌面，立即停止并落盘风险）；
  - 落盘 test results / PRD review / handoff / minimal-fix 文档。
- 不扩展：Phase 1（真实六视频 fresh run）、B-5-4..B-5-7、B-6/B-7、Stage C/D/E、
  V3-6/V3-7、chat-know 增量、修改 product code、扩展 CommonPrivacy 边界、
  调整六视频固定分母、调整 secret 扫描白名单。

## 2. 验收门槛

| ID | 描述 | 门槛 |
|---|---|---|
| PH0-AR-1 | runner 只读审计 | runner 与 sequencer 全部控制分支（fresh isolation、退出码、SIGTERM/异常清理、超时、单 blocked/两个 blocked、secret scan、禁止上传计数、Chrome worker 缺失、cleanup fail-closed）落到本文件 + 测试用例 |
| PH0-AR-2 | 既有候选测试 | `node --test scripts/stage_b_b5_3/test/contracts.node-test.mjs` 48/48 PASS；`node --test scripts/stage_b_b5_3/test/sequencer.node-test.mjs` 11/11 PASS |
| PH0-AR-3 | 测试纯度 | 测试不启动 Chrome / 不启动 Runtime / 不触发外部网络 / 不播放任何声音；所有 Chrome 相关路径通过 stub 或 subprocess 驱动（PH0-AR-11 / PH0-AR-12 集成测试除外） |
| PH0-AR-4 | Stage A 根因 | 7 分钟超时根因落到具体文件:行（`run_one_bvid.mjs:289-307` 旧轮询逻辑 + `task_store.py:197-231` `media_source_authority` 写入 + `coordinator.py:307-349` resolve 内存字典），并指明每项修复是否受现有文档支持 |
| PH0-AR-5 | M-1 状态机矛盾修复 | 真实 branch + 测试：runner 见到 `media_source_authority.state ∈ {"active","published"}` → 必须通过 `POST /v1/media/outline-tasks` 创建 `media_tasks` 行 → 轮询 `media_tasks.state ∈ {"ready","degraded"}` 才视为 Stage A 完成；不允许把 `active/published` 当作 Stage A 终态直接进入 synthesize |
| PH0-AR-6 | M-2 消除未定义变量 | runner 成功路径必须从真实响应取得 `taskId`（outline-tasks 响应或 media_tasks 行），不再引用未定义的 `projections.taskId`；`node --check scripts/stage_b_b5_3/run_one_bvid.mjs` PASS |
| PH0-AR-7 | M-3 outline-task 创建原子证明 | 真实 Runtime API 集成测试：启动本地 navia_runtime，`POST /v1/media/outline-tasks` 成功落 `media_tasks` 行（mode 0o600）+ 正确字段；启动失败的 Runtime 也要检查响应体 |
| PH0-AR-8 | M-4 启用动作 + 权限 | runner 在 launcher 点击后必须 click `[data-testid='media-companion-enable']`；Chrome 权限提示若出现 → 通过 X11 fake-click 或 `chrome.permissions.contains` 检查 + 跳过；可重复覆盖 launch + enable 分支 |
| PH0-AR-9 | M-5 非零失败退出 | runner + sequencer 任何未被捕获异常 / sequencer 状态中断 / runner 异常退出 → sequencer 进程 `exitCode ≠ 0`；测试用例必须证伪"exit 0 with failed disposition" 状态 |
| PH0-AR-10 | M-6 真实故障 branch 测试 | SIGTERM（发送 SIGTERM 到 runner 子进程 + 验证 cleanup.json + 验证 Runtime kill）、Runtime crash（Runtime 子进程被 kill 后 runner 报错路径）、service worker 缺失（mock `chromium.launchPersistentContext` 拒接 serviceWorker 事件）、Chrome permission 缺失（chrome.permissions.request 报 `permissions_denied`）、cleanup failure（`profileRoot` 已被另一进程占用）—— 每个 case 必须驱动真实 runner 代码路径（不是 stub） |
| PH0-AR-11 | 真实 Runtime API 集成 | `scripts/stage_b_b5_3/test/integration_runtime_api.node-test.mjs` 在 sandbox 上启动真实 navia_runtime（无需 Chrome）→ `POST /v1/media/outline-tasks` → `GET /v1/media/outline-tasks/<id>` → `POST /v1/media/tasks/<id>/comprehension/synthesize` → 验证 11 字段 receipt + 6 upload counters = 0；不依赖 Provider（使用现有 Mock provider 或跳过 Provider 调用） |
| PH0-AR-12 | 1 个固定 BVID 静音 Chrome canary | `scripts/stage_b_b5_3/test/canary_bvid1.node-test.mjs` 启动真实 Chrome（带 `--mute-audio` + Xvfb headless=false + 复用既有 `chrome-v2-t01-r1-frontend.mjs::launchExtension`）+ 真实 Runtime + 复用 `v3-media-experience-stage-a-fresh.mjs:340-372` 启用动作 → 对 `BV1pohR6rEEh` 跳一次完整 Stage A；可被权限/桌面要求打断 → 立即终止并落盘风险 |
| PH0-AR-13 | 不启动真实 run | 本 Phase 0 期间无真实六视频 fresh run 被启动；canary 是单 BVID smoke test，不构成 fresh run |
| PH0-AR-14 | 不 commit/push | 工作树新增 lib/test/fixture/doc 与 runner 最小修改均不自动 commit/push |

## 3. 风险闭环

| 风险 | 闭环 |
|---|---|
| 修改 runner 误改产品行为 | runner 仅改 polling 目标（`media_tasks → media_source_authority`）+ try/catch + 诊断文案 + outline-task 创建 + 启用动作 + 非零失败；不动 schema、不动 product code、不动合同、不动分母 |
| 测试不真实契约 | sequencer 测试通过子进程驱动真实 `sequencer.mjs` + stub runner；新增 `integration_runtime_api.node-test.mjs` 启动真实 navia_runtime；`canary_bvid1.node-test.mjs` 启动真实 Chrome（带 `--mute-audio`） |
| 测试污染工作树 | 全部测试用 `os.tmpdir()` 沙箱；测试结束 `fs.rmSync` 清理；integration / canary 测试单独 evidence dir |
| 测试与既有 Chrome e2e 工具冲突 | 既有 contract / sequencer 测试仍不调用 `chromium.launch*`；integration 与 canary 测试必须显式 `--mute-audio` |
| 替换 `media_tasks` 误改下游逻辑 | `media_source_authority` 是 resolve 流程唯一写入的表（`coordinator.py:312-323` → `task_store.py:197-231`），但仅作为 reconcile-pending 信号；Stage A 完成必须依赖 `media_tasks.state` |
| M-1 状态机矛盾 | runner 在 `media_source_authority.state ∈ {"active","published"}` 后立即 `POST /v1/media/outline-tasks` 创建 `media_tasks` 行，再轮询 `media_tasks.state ∈ {"ready","degraded"}` |
| M-2 未定义 `projections.taskId` | runner 改用 `outlineTaskId`（来自 outline-tasks 响应）或 `mediaTask.task_id`（来自 media_tasks 行），且 `node --check` 强制执行 |
| M-3 outline-task 缺失 | runner 在 synthesize 之前先 `POST /v1/media/outline-tasks`（`app.py:1365-1380`），要求 201 + `task.id` 非空 + 后续可在 `media_tasks` 表查到（PH0-AR-11 真实 Runtime 集成验证） |
| M-4 启用动作 + 权限 | runner 在 launcher 点击后必须点击 `[data-testid='media-companion-enable']`；canary 中复用 `v3-media-experience-stage-a-fresh.mjs:340-372` X11 ctypes fake-click |
| M-5 退出码 | runner + sequencer 必须 `process.exitCode = 1`（或抛 `process.exit(1)`）；任何未被捕获异常必须非零退出；测试用 `assert.notEqual(proc.status, 0)` 证伪"exit 0 with failed" |
| M-6 真实故障 branch | SIGTERM / Runtime crash / worker 缺失 / permission 缺失 / cleanup failure 必须驱动真实 runner 代码路径；新测试 `real_branches.node-test.mjs` |
| 残余风险：synthesize endpoint 需要 media_tasks 行 | 由 M-3 修复；本计划通过 PH0-AR-11 真实 Runtime API 集成关闭 |
| 残余风险：扩展不发 `media-companion-enable` 点击 + chrome.permissions.request 提示 | 由 M-4 修复；本计划通过 PH0-AR-12 canary 关闭 |

## 4. 详细实施步骤

### 步骤 1 — runner + sequencer 只读审计（候选基线）

- [x] 完整阅读 `run_one_bvid.mjs`（507 行）+ `sequencer.mjs`（127 行）；
- [x] 列出所有 fresh isolation 入口（profile / runtime / dbPath / mediaTaskRoot /
      mediaAsrTaskRoot / mediaDownloadCacheRoot / TASK_NAMESPACE）；
- [x] 列出所有退出路径（成功 throw → catch / finally cleanup；
      failure-diagnostic 落盘 / cleanup.json 落盘）；
- [x] 列出所有超时路径（Stage A 7 分钟 = `7 * 60_000` ms、extensionWorker
      30 秒、page.goto 60 秒、launcher 30 秒、runtime 60 秒）；
- [x] 列出 secret scan（6 条：sk-、sk_live_、AIza、gho_、deepseek-、minimax-）
      与 upload counter（6 项全 0 校验）；
- [x] 列出 Chrome cmdline 强校验（`--mute-audio`、`--load-extension`、
      `--disable-extensions-except`、`--user-data-dir=`），
      并核对 `NAVIA_CHROME_MUTE_AUDIO=0` 拦截逻辑。

### 步骤 2 — 抽取可独立测试的纯 helper（候选基线）

- [x] 创建 `scripts/stage_b_b5_3/lib/contracts.mjs`：
      `BVID_PATTERN`、`ORDER_PATTERN`、`SECRET_PATTERNS`（6 项冻结）、
      `UPLOAD_COUNTER_HARD_ZERO`、`REQUIRED_UPLOAD_COUNTER_KEYS`、
      `REQUIRED_V21_RECEIPT_FIELDS`（17 项）、
      `PROVIDER_LOCK`、`DERIVED_TEXT_SCOPE`、`MAXIMUM_BLOCKED_FOR_STAGE_EXIT`、
      `parseArgs`、`sha256`、`writeJson`（mode 0o600）、
      `writeText`（mode 0o600）、`ensure`、`wait`、`detectSecretHits`、
      `scanFileForSecrets`、`validateUploadCounters`、
      `missingReceiptFields`、`assertMuteAudioFlag`、
      `assertChromeCmdlineFlags`、`classifyDispositionFromStageA`；
- [x] runner 后续可引用同模块以保持单源；本 Phase 0 不重构 runner
      现有内联 helper（避免扩大 diff 范围）。

### 步骤 3 — 既有候选测试（59/59 PASS 不构成 P0 出门 PASS）

- [x] `scripts/stage_b_b5_3/test/contracts.node-test.mjs`：48 项 node:test
      单元/契约测试；
- [x] `scripts/stage_b_b5_3/test/sequencer.node-test.mjs`：11 项 sequencer
      集成测试；
- [x] 测试不启动 Chrome / Runtime / 外部网络 / 声音。

### 步骤 4 — Stage A 根因定位（候选基线）

完成；详细根因落盘 `stage-b-b5-3-phase0-root-cause-2026-10-15.md`。

### 步骤 5 — 关闭 M-1 状态机矛盾（M-5 同时关闭）

**目标**：runner 见到 `media_source_authority.state ∈ {"active","published"}`
→ 必须 `POST /v1/media/outline-tasks` 创建 `media_tasks` 行 →
轮询 `media_tasks.state ∈ {"ready","degraded"}` 才视为 Stage A 完成。

修改：
1. 把 `media_source_authority` 视为"reconcile-pending"信号：仅在
   `state ∈ {"active","published"}` 时调用 outline-task 创建端点；
2. outline-task 创建端点：`POST http://127.0.0.1:${port}/v1/media/outline-tasks`
   body `{ "sourceIdentity": "portal:bilibili:<bvid>:1:1" }`，
   期望 201 + `data.task.task_id` 非空；
3. 创建后再轮询 `media_tasks` 表，等到 `state ∈ {"ready","degraded"}` 才
   视为 Stage A 完成；
4. 旧的 `media_source_authority` 直接接受 `active/published` 当终态的代码
   必须删除；
5. 新增 `phase0StageASignal()` 集中状态机函数，避免分散逻辑。

测试（PH0-AR-5）：
- `state-machine-authority-pending.node-test.mjs`：
  - 模拟 authority 写入 `active` 但 `media_tasks` 无行 → runner
    调用 outline-task POST → media_tasks 写入 → ready；
  - 模拟 authority `published` 但 `media_tasks` 仍 `created` →
    runner 仍需等 `media_tasks.state ∈ {ready, degraded}`；
  - 模拟 outline-task POST 失败 → runner 抛错并写
    `finalDisposition = "failed"`；
  - 模拟 outline-task POST 成功但 media_tasks 30 秒内仍 `created` →
    runner 走 7 分钟超时分支，`finalDisposition = "blocked"`。

### 步骤 6 — 关闭 M-2 消除未定义 `projections.taskId`

修改：
1. runner 内 `projections.taskId` / `convergence.revision` 全部改用真实变量
   `outlineTaskId`（来自 outline-task POST 响应 `data.task.task_id`）和
   `mediaTaskRevision`（来自 media_tasks SELECT 行）；
2. `node --check scripts/stage_b_b5_3/run_one_bvid.mjs` 必须 PASS；
4. 新增 `node --test scripts/stage_b_b5_3/test/syntax-check.node-test.mjs`
   用 `node:vm` 编译 runner 顶层 + 验证 `projections` 不再出现。

### 步骤 7 — 关闭 M-3 outline-task 创建原子证明

由 PH0-AR-11 真实 Runtime API 集成测试驱动：
- 启动本地 navia_runtime（`PYTHONPATH=.` 直接 `python3 -m uvicorn
  navia_runtime.app:app`），等待 `/v1/health`；
- `POST /v1/media/outline-tasks` body `{ "sourceIdentity": "portal:bilibili:
  BV1acaTEST:1:1" }`，期望 201 + `task.id` 形如 `media_task_[0-9a-f]{32}`；
- 通过 sqlite3 cli 查 `media_tasks` 表，确认新行 mode 0o600 + 字段齐全；
- `POST /v1/media/tasks/<id>/comprehension/synthesize` body
  `{ "expectedRevision": 1, "consent": true, "style": "structured" }`，
  期望 200 + 11 字段 receipt + 6 upload counters = 0；
- 失败 → 测试 fail + 真实诊断。

### 步骤 8 — 关闭 M-4 启用动作 + 权限

由 PH0-AR-12 canary 驱动：
- runner 在 launcher 点击后必须 click
  `[data-testid='media-companion-enable']`（来源
  `v3-media-experience-stage-a-fresh.mjs:340-372`）；
- 启用按钮点击后尝试 `chrome.permissions.contains({origins: ["https://*.bilibili.com/*"]})`；
- 若权限不足 → X11 ctypes fake-click native prompt（`v3-media-experience-
  stage-a-fresh.mjs:343-368`）；
- 若 fake-click 失败 → runner 终止 canary 并写 canary-failure.json；
- 若 chrome.permissions.request 失败 → runner 把失败写到
  `failure-diagnostic.json` 并 `finalDisposition = "blocked"`。

### 步骤 9 — 关闭 M-5 非零失败退出

修改：
1. runner catch 块末尾必须 `process.exitCode = 1`（除非 disposition=blocked）；
2. sequencer 在主循环结束后必须：
   - 任何 `final_disposition.txt` 缺失 → `aggregate.stopped = true` +
     `stopReason` 写明 + 退出码 1；
   - 任何 child process.exit 非 0 且非 1（如 SIGTERM 143）→ 退出码 1；
   - 任何 bvid count < 6 + `stopped=false` → 退出码 1（runner 异常未
     落 `final_disposition.txt`）；
3. 测试 `non-zero-exit.node-test.mjs`：
   - sequencer 死因 1：child process kill -9 → sequencer 必须 exit 1；
   - sequencer 死因 2：所有 bvid 都缺 final_disposition.txt → exit 1；
   - sequencer 死因 3：全部 6 bvid 顺利 → exit 0。

### 步骤 10 — 关闭 M-6 真实故障 branch 测试

新增 `scripts/stage_b_b5_3/test/real_branches.node-test.mjs`：
- SIGTERM：在 5 秒窗口发送 SIGTERM 给 runner 子进程；runner 必须
  `runtime.kill("SIGINT")` + `profileRoot.rmSync`，写
  `cleanup.runtimeScratchDeleted=true` + `cleanup.profileRootDeleted=true`，
  child 退出码非 0；
- Runtime crash：在 runtime 启动后立刻 `kill -9`；runner 必须
  写 `failure-diagnostic.json` 含 `error.message` 含"runtime exit"，
  child 退出码非 0；
- service worker 缺失：mock `chromium.launchPersistentContext` 立即抛错
  "MV3 service worker never registered"；runner 必须写
  `failure-diagnostic.json` 含 service worker 缺失标识，exit ≠ 0；
- Chrome permission 缺失：在 canary 中 chrome.permissions.request 拒绝；
  runner 必须 `finalDisposition = "blocked"` + reason 含
  `chrome_permissions_denied`；
- cleanup failure：pre-create `profileRoot` 下子文件 `phantom.lock` 让
  `fs.rmSync` 失败（chmod 130）；runner 必须仍然写 cleanup.json（含
  `profileRootDeleted=false`）+ 不抛 uncaught，child 退出码非 0。

### 步骤 11 — 真实 Runtime API 集成（PH0-AR-11）

新增 `scripts/stage_b_b5_3/test/integration_runtime_api.node-test.mjs`：
- `await waitForRuntime` 等待 `/v1/health`；
- `POST /v1/media/outline-tasks`；
- `POST /v1/media/tasks/<id>/comprehension/synthesize`；
- 不依赖 Provider（Mock 或跳过；Mock provider 在 runtime 默认配置下）；
- 测试用 sandbox `os.tmpdir()`；
- 测试结束 `fs.rmSync`；
- 测试失败立刻 `kill -9` runtime 子进程。

### 步骤 12 — 1 个固定 BVID 静音 Chrome canary（PH0-AR-12）

新增 `scripts/stage_b_b5_3/test/canary_bvid1.node-test.mjs`：
- 复用 `chrome-v2-t01-r1-frontend.mjs::launchExtension()` 启动 Chrome
  + `--mute-audio` + `--load-extension` + `--disable-extensions-except`
  + `--user-data-dir`；
- 复用 `v3-media-experience-stage-a-fresh.mjs:340-372` 启用动作；
- 复用 `v3-media-experience-stage-a-fresh.mjs:286-313`
  `startRuntime()` + `waitForRuntime()` 启动 navia_runtime；
- 导航 `https://www.bilibili.com/video/BV1pohR6rEEh`；
- 走 runner 流程：launcher → enable → outline-task → wait →
  synthesize → V2.1 落盘 → 6 upload counters → final_disposition;
- canary 跑前必须先确认 `NAVIA_BROWSER_EXECUTABLE` 与 `display` 可用；
- canary 跑完写到独立 evidence 目录；
- canary 跑完立刻清理 Chrome / Runtime / profile / scratch；
- canary 限制：单 BVID `BV1pohR6rEEh`；不构成 fresh run；可被权限 /
  桌面要求打断 → 立即终止并落盘风险。

### 步骤 13 — Phase 0 落盘文件

完成下列文件（与 `03-authoritative-file-index.md` 平行）：
- `stage-b-b5-3-phase0-detailed-plan-2026-10-15.md`（本文件）
- `stage-b-b5-3-phase0-acceptance-criteria-2026-10-15.md`
- `stage-b-b5-3-phase0-preimplementation-audit-2026-10-15.md`
- `stage-b-b5-3-phase0-root-cause-2026-10-15.md`
- `stage-b-b5-3-phase0-test-results-2026-10-15.md`
- `stage-b-b5-3-phase0-prd-review-2026-10-15.md`
- `stage-b-b5-3-phase0-handoff-2026-10-15.md`
- `stage-b-b5-3-phase0-minimal-fix-runner-should-not-apply-2026-10-15.md`

### 步骤 6 — Phase 0 落盘文件

完成下列文件（与 `03-authoritative-file-index.md` 平行）：
- `stage-b-b5-3-phase0-detailed-plan-2026-10-15.md`（本文件）
- `stage-b-b5-3-phase0-acceptance-criteria-2026-10-15.md`
- `stage-b-b5-3-phase0-preimplementation-audit-2026-10-15.md`
- `stage-b-b5-3-phase0-root-cause-2026-10-15.md`
- `stage-b-b5-3-phase0-test-results-2026-10-15.md`
- `stage-b-b5-3-phase0-prd-review-2026-10-15.md`
- `stage-b-b5-3-phase0-handoff-2026-10-15.md`
- `stage-b-b5-3-phase0-minimal-fix-runner-should-not-apply-2026-10-15.md`

## 5. 失败码映射（仅审计 / 测试 / 诊断）

| 类别 | 来源 | 本 Phase 0 处置 |
|---|---|---|
| runner 7 分钟超时（runner state-machine） | `run_one_bvid.mjs:289-307` 旧轮询 | 修复完成；签名保留 `blocked` disposition（与 `allowedFinalDispositions` 一致），但 finishReason 准确记录 |
| 真实 bilibili 访问限制 | resolve 端点返回 `disposition=blocked` 或 `error.code` 以 `V3510B_BVID` 开头 | 修复后保留 `resolveResponses` 检查，真实 block 仍能被识别 |
| execFileSync transient | sqlite 锁 / 表未迁移 | 修复后日志 + 继续，不 break sequencer loop |
| 6 upload counters 非 0 | 任何 BVID receipt | Phase 0 未启动真实 run，无相应 runner 路径触发 |
| secret scan 命中 | 任何 BVID 落盘 | Phase 0 未启动真实 run，无相应 runner 路径触发 |

## 6. 风险与不达预期处置

- 真实 fresh run 启动前必须先解决扩展不发 `media-companion-enable` 点击 +
  `chrome.permissions.request` native prompt 处理；当前 working test
  `apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs:340-372`
  通过 X11/Xvfb fake-click 模拟 native prompt（`ctypes` 调
  `libX11.so.6` / `libXtst.so.6`），Phase 1 启动 fresh run 前必须先在
  runner 中复用相同基础设施；本 Phase 0 不在范围内（避免扩大权限 / 改变
  隐私边界）；
- 真实 fresh run 启动前必须确认 synthesize 端点能成功调用 —— 当前
  `media_tasks` 行缺失（扩展不发 `POST /v1/media/outline-tasks`），synthesize
  端点 `require_current_authority` 会失败；Phase 1 必须在 runner 中先
  `POST /v1/media/outline-tasks` 创建媒体任务，再调 synthesize；
- Phase 0 完成后必须由独立 Claude Code CLI 审查代理执行出门复算
  （与 `handoffs/.../06-independent-review-prompt.md` 一致），本会话不替
  独立审查作最终结论；
- Phase 0 任何代码修改、测试、PRD 检视、handoff 均不 commit / push；
  单独整理后由用户决定提交窗口。

## 7. 出本计划的依赖

- AGENTS.md（主项目规则）；
- `docs/active/project/design/project-stage-workflow.md`（项目阶段循环）；
- `docs/active/project/handoffs/v3-claudecode-continuation-2026-10-14/`
  01..07（恢复入口与权威索引）；
- `stage-b-b5-3-detailed-plan-2026-10-14.md` + acceptance +
  preimplementation-audit + automation-recovery-addendum +
  stop-report-correction（B-5-3 权威计划族）；
- `stage-b-six-video-registry.json` v1（六视频固定分母冻结）；
- `stage-b-route-2-contract-fixtures.json` +
  `verify-stage-b-route-2-contract-fixtures.py`（V2.1 接收合同）；
- `independent-b5-1-b5-2-implementation-audit-2026-10-14.md`
  （B-5-3 READINESS CONDITIONAL PASS）；
- 用户授权（一次性覆盖完整 6 BVID fresh run + 派生 transcript/OCR/
  vision-caption 文本上传；原始视频/音频/Cookie/key/path 不传；
  Chrome 必须 `--mute-audio`）。

## 8. 不在本 Phase 0 范围

- 不启动真实 fresh run；
- 不修改 product code；
- 不修改 schema / 合同 / fixtures；
- 不 commit / push；
- 不替独立审查作最终 PASS；
- 不引入新的 chrome 启动逻辑 / Runtime 启动逻辑 / Provider 客户端；
- 不调整六视频固定分母；
- 不调整 secret scan 白名单；
- 不模拟 chrome.permissions.request native prompt。

## 9. 出门后 → Phase 1 衔接

- Phase 0 出门（独立审查允许）→ Phase 1（B-5-3 真实六视频 fresh run）必须先
  解决以下两项（与 `02-remaining-development-plan.md §Phase 1` 一致，但额外
  增加两项新需求）：
  1. 复用 `v3-media-experience-stage-a-fresh.mjs:340-372` 的
     `media-companion-enable` 点击 + X11 ctypes fake-click native prompt
     处理；
  2. 在 runner 调 synthesize 前先调 `POST /v1/media/outline-tasks`
     创建 `media_tasks` 行（`task_store.create`），让
     `require_current_authority` 不再失败；
- Phase 1 跑通后 → B-5-4（清理与汇总独立审查）→ B-5-5（closure 包）→
  B-5-6（handoff 到 B-6）→ B-5-7（external-audit-package ≤ 20 文件）→
  B-6/B-7/Stage C/D/E/V3-6/V3-7；
- Phase 1 仍未启动 `v3-5.10 Stage B B-5-3 acceptance` 任何最终 PASS。

## 10. 2026-10-15 最新恢复修订（优先于旧候选自报）

旧计划中“runner 创建独立 outline task 再轮询”的设计在真实 Cookie canary 中产生 source authority task 与 outline task 分裂，属于架构缺陷。用户已批准限定 Route A：同一 `sourceIdentity` 的 outline task 必须复用 authority task ID。为关闭该缺陷，P0 允许最小修改 Runtime `POST /v1/media/outline-tasks` 及其 focused tests；这不是公共 schema 变化，也不授权其他产品代码扩展。

当前最新事实：

- Route A Runtime 候选及 focused Python/Node integration 已通过局部验证。
- muted canary `/tmp/navia-b5-3-canary-1792053808072` 已真实得到 resolve/authority/outline 201，且 task ID 相同。
- canary 因只读取 `data.task.task_id` 而未读取公共 `data.task.taskId` 失败；该 run 是 diagnostic-only，不能改写为 PASS。
- 修复解析后必须先证明 materialize 的唯一编排所有者与真实状态迁移，再执行下一次 canary。runner 不得直接改数据库或伪造 `ready/degraded`。
- Runtime crash、worker missing、permission missing、cleanup failure 仍需真实边界证据；旧 74/74 自报与伪 real-branch tests 不构成关闭。

因此 Phase 0 仍 `NO-GO`。本节替代 §8 中“不修改 product code”的绝对表述，并替代任何把 canary 或 6 项 Major 写成已关闭的旧候选结论。

## 11. 2026-10-15 17:10 编排纠偏（当前权威计划）

`taskId` helper 和 trace 初始化缺陷已经形成候选并通过 focused tests。最新 canary `/tmp/navia-b5-3-canary-1792055036947` 证明 runner 手工创建 outline 后任务停在 `created`；其 acquisition 仍为 `awaiting_trusted_capture`。这不是可接受 terminal。

当前冻结 Side Panel `materializeCurrentMediaTask` effect 为唯一产品 materialize 编排者。runner 必须移除成功路径中的手工 create/materialize 编排，通过 `media-capture-start` 与 `media-capture-finish` 真实可信点击推进无字幕视频，等待 acquisition `succeeded`，再观察 UI 自动 visual materialize/fallback 与 `ready|degraded`。Runtime create/authority Route A 继续由独立 API 集成测试验证。

下一顺序：runner 用户路径修复 -> focused/full offline tests -> 一次条件已改变的 muted canary -> crash/worker/permission/cleanup/SIGTERM 真实故障矩阵 -> immutable candidate -> 独立审查。六视频仍禁止启动。

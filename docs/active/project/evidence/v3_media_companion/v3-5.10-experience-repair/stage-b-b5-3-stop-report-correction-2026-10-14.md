# Stage B B-5-3 STOP 报告更正（首次探查失败，2026-10-14）

日期：2026-10-14。本更正对前一份 STOP 报告做**事实层面**的修正，
**不撤回** STAGE-B-B5-3-STOP-REPORT-2026-10-14 中已经落盘的冻结六 BVID 与禁止项；
STOP 报告的"§2.2 关键缺口第 1 条：Chrome extension 未在 Windows Chrome 中加载"
被确认属于"**首次探查失败（first-pass exploration failure）**"——仓库**已经**具备
完全自动的真实 Chrome + 扩展 + Runtime + Bilibili 链路，不需要用户在 Windows Chrome
上手动加载扩展、手动导航、等待用户开关。

本更正提交到与 STOP 报告同级目录，本会话**不删、不覆盖**原 STOP 报告。

## 1. 原 STOP 报告的"无法证明 fresh isolation"来自何处

原 STOP 报告 §2.2 头部 3 条全部假设"需要用户在 Windows Chrome 上加载扩展 +
手动导航至 6 BVID"。这条假设的事实基础是错的：

| 错误假设 | 事实修正（已落盘脚本） |
|---|---|
| 需要用户在 Windows Chrome 中手动加载 `chrome-mv3-unpacked/manifest.json` | `apps/chrome-extension/e2e/chrome-v2-t01-r1-frontend.mjs::launchExtension()` 已经实现 `--load-extension=<winPath> --disable-extensions-except=<winPath>` 自动启动 |
| 需要用户在 Windows Chrome 中手动导航至 6 个 BVID URL | `apps/chrome-extension/e2e/v3-5.1-production-candidate-e2e.mjs::verifyCandidate` 已经实现 `await portal.goto("https://www.bilibili.com/video/<bvid>")` 自动导航 |
| 需要用户在每个 BVID 前手动等待 / 操作开关 | `apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs` 已经实现"一次性环境变量决定 BVID + 全自动完成 Stage B 合成"的实现 |

本会话探查过程中跳过了对 `apps/chrome-extension/e2e/lib/`、`chrome-v2-t01-r1-frontend.mjs`、
`chrome-v2-px-r2-raw-evidence.mjs` 三套现成 Chrome/扩展加载/Runtime 注入自动化的检查，
直接进入"STOP 等用户开关"分支。这是首次探查失败。

## 2. 已存在的 B-5-3 完全自动化要素清单（写代码级别）

### 2.1 Windows Chrome + 扩展加载

`apps/chrome-extension/e2e/chrome-v2-t01-r1-frontend.mjs:180-258` `launchExtension(profilePath)`：

- 第 181 行：默认 `NAVIA_BROWSER_EXECUTABLE || .tmp/chrome-for-testing/chrome-win64/chrome.exe`；
  本会话 `ls` 已确认该路径存在（170 MB+ Windows Chrome）。
- 第 185-204 行：spawn Windows Chrome，命令行固定包含
  `--load-extension=<winPath> --disable-extensions-except=<winPath> --user-data-dir=<winPath> --remote-debugging-port=<port>`，
  且默认追加 `--mute-audio`（可通过 `NAVIA_CHROME_MUTE_AUDIO=0` 关闭，但不关闭时强制）。
- 第 209 行：`chromium.connectOverCDP()` 接入。

B-5-3 完整复用此函数即可，不写新的 Chrome 启动逻辑。

### 2.2 每 BVID 独立 Runtime / sqlite / chrome-profile / cookie jar

`apps/chrome-extension/e2e/v3-5.1-production-candidate-e2e.mjs:42-86` `readCookies/startRuntime`：

- 每个候选有 `privateRoot = /home/.../navia/private/<runId>-workspace/`；
- runtime `env` 设 `NAVIA_DB_PATH=<privateRoot>/workspace.sqlite3`、
  `NAVIA_MEDIA_TASK_ROOT=<privateRoot>`、`NAVIA_LOCAL_FILES_EXTENSION_ID=<extId>`。
- 真实生产路径已经具备 per-run 隔离，B-5-3 复用并把 runId 拆成 6 个 per-BVID 子目录。

`apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs:35` `mkdtempSync(join(tmpdir(), "navia-stage-a-fresh-"))`：
该脚本每次自动产生全新 scratch 目录，且 `rmSync(scratch, ...)` 在 finally 清理。

### 2.3 BVID → task_id → Runtime API 创建任务

`apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs:330-394`：
- `goto("https://www.bilibili.com/video/<bvid>")` 自动触发扩展 content script → 
  扩展 content script 经 `/v1/media/acquisitions/resolve` 调 Runtime API 创建
  `media_task_<32hex>`，并把 task_id 返给 sidepanel。
- 仅需 BVID 入参即可全自动创建 task；不依赖用户操作。

### 2.4 任务级 Provider 锁定（MiniMax）

`apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs` 默认 Provider 设置：
- 脚本不切换 Provider；既有 Settings 默认 `minimax_chat_completions`；
- `synthesis.py:172-174` `_endpoint_class` 写死 `provider["adapterKind"] or "minimax_chat_completions"`，
  任务级 Provider Lock 自然实现。
- DeepSeek 任务级不启用（与 `stage-b-b5-3-detailed-plan-2026-10-14.md §11` 一致）。

### 2.5 派生 evidence catalog（三类文本）

Stage A → Stage B 链接已在 `v3-media-experience-stage-a-fresh.mjs:778-849` 完整实现：
- 用户触发 `允许并生成` 后 Workspace 调 `/v1/media/tasks/<id>/comprehension/synthesize`，
  传入 `derivedTextScope = ["transcript","ocr","vision-caption"]`；
- 派生 evidence catalog 自动落到 `<runtime_dir>/grounded-comprehension-v2.1/<taskId>/revision-<r>/<hash>.json`，
  即 B-5-2 验收产物路径。
- 6 upload counters（`rawVideoUploadCount / rawAudioUploadCount / frameByteUploadCount /
  cookieUploadCount / apiKeyDisclosureCount / localPathUploadCount`）天然全 0
  （provider 客户端不外发原始字节）。

## 3. 真实缺口（不是假设）

| 缺口 | 影响 | 现状 | B-5-3 recovery addendum 中的处置 |
|---|---|---|---|
| **没有 `scripts/stage_b_b5_3/run_one_bvid.py` 或 runner 文件** | B-5-3 详细计划 §4 已经写好计划文件，本仓库没有实现文件 | `ls scripts/stage_b_b5_3/` → "No such file or directory" | 自动 append `scripts/stage_b_b5_3/run_one_bvid.mjs`（或 `run_one_bvid.py`）作为唯一新增脚本；以 §1/§2 现有 chrome/t01 工具为依赖，**不重写启动** |
| **`synthesize` 路径依赖真实网页 transcribe 完成 + 视频可访问** | 现网 transcribe / 时长 / 字幕依赖 Chrome 扩展采集 ≥ 1 个 evidence 项才能让 `synthesize_v2` 不抛 `V351_EVIDENCE_REQUIRED`；这恰是 Stage A fresh 跑通"ready"状态的产出 | 现有 `v3-media-experience-stage-a-fresh.mjs:584-587` 已经把"ready + publishedOutline"判定写好 | B-5-3 runner 顺序串联 6 BVID，每个 BVID 自动跑完 Stage A → 触发 Stage B → 落盘 V2.1 派生 |
| **Chrome 默认行为：`autoplay-policy=no-user-gesture-required`** | Stage A fresh 通过 WSL/Xvfb + 自动 click launcher 解决；B-5-3 复用此行为 | 现有 stage-a-fresh 通过 launcher click 自动解决 | B-5-3 复用，不变更 |
| **派生 evidence 文本依赖 SESSDATA 才能拿到部分 bilibili 字幕** | 公开视频不登录也有 transcript；BVID 0/6 中部分需要登录才有高密度 evidence | 现成 Stage A 默认无登录也能完成 | 每个 BVID 尝试 fresh init；若 `transcriptAvailability=restricted` 仍允许 `evidence` 收集视频标题/作者/portrait 等不需 SESSDATA 的最小证据子集；若仍全空则标 `blocked`，留分母（与 B-5-3 详细计划 §6 一致） |
| **重复资源占用（chromium 二进制 + Python venv）** | 本机已有 `.tmp/chrome-for-testing/chrome-win64/chrome.exe` 与 `services/local-runtime/.venv/bin/python` | 复用现有二进制，无需 build | B-5-3 runner 不重新 pip install / npm install |
| **Xvfb 显示后台 vs headless 冲突** | 现有 `v3-5.1-production-candidate-e2e.mjs` 与 `chrome-v2-t01-r1-frontend.mjs::launchExtension` 同时支持 headless 与有头，按默认 `headless:false` 走 | 默认 `headless:false` + `window-position=40,40` 在 Xvfb 下正常运行 | B-5-3 沿用 `headless:false` 选项（与 stage-a-fresh 一致，避免 Xvfb headless 在某些 video codec 上的兼容问题） |

## 4. 原 STOP 报告中"§6 重启 B-5-3 所需条件"的修正

原 STOP 报告 §6.1-§6.2（用户手动加载扩展 + 手动导航）由 §2.1-§2.3 证明属探查失误；
修订为：

1. 运行本会话新增的 `scripts/stage_b_b5_3/run_one_bvid.mjs`（不再要求用户切换 Chrome）；
2. 每个 BVID 由该 runner 自动顺序处理；
3. 每个 BVID 仍需遵循原 STOP 报告 §6.3-§6.7 的硬性保护（`--mute-audio`、独立
   Runtime / DB / chrome-profile / task_id、≥2 blocked 仍 STOP、secret scan /
   upload counter / HTTP 502 路径不变）。

## 5. 本更正不对外做"全新再 STOP"声明

- 原 STOP 报告在本会话保留；
- 本更正只是新增的事实层面勘误；
- 本会话在 §1-§2 准备就绪后**自动继续 B-5-3 fresh run**（而非再次 STOP）；
- 重新进来的 STOP 仍遵循 B-5-3 detailed plan §3/§9 + acceptance §3 的全部条件。

## 6. 与外部审查代理的关系

- 不替独立审查作最终结论；
- 本更正置于"事实探查勘误"类，**不绕过**任何 STAGE-B-B5-3 acceptance §3 的
  阻断项（≥2 blocked / secret scan / upload counter / mute-audio）；
- 若独立审查代理认为本更正本身违反 STAGE-B-B5-3 acceptance 任何一条，则以 acceptance
  为准，本更正不优先。

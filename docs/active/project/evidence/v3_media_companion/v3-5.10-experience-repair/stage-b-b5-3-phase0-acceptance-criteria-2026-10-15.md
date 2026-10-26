# Stage B B-5-3 Phase 0 验收标准（runner 恢复审计、测试补齐、根因定位，2026-10-15）

日期：2026-10-15。本文件仅冻结验收门槛与复算命令，由独立审查代理在
Phase 0 出门前逐条复算。本 Phase 0 不执行真实 fresh run；不修改 product
code；不修改 schema / 合同 / fixtures；不 commit / push。

## 1. 验收原则

- 验收只接受本仓库既有测试与真实落盘的 runner 状态审计，不接受凭旧产物
  顶替新 runner；
- 单元/契约测试可在 < 5 秒内跑完；
- 任何 runner 修复必须明确受
  `apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs`
  或 `task_store.py` / `coordinator.py` 文档支持；
- 任何禁止数据上传（原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径）仍
  受 B-5-3 hard gate 约束（runner 已 hard-coded 6 upload counters = 0 +
  secret scan 6 PATTERN = 0 命中）。

## 2. 自动验收分母

### PH0-AR-1 runner 只读审计

- `scripts/stage_b_b5_3/run_one_bvid.mjs` 与 `scripts/stage_b_b5_3/sequencer.mjs`
  全部控制分支（fresh isolation、退出码、SIGTERM/异常清理、超时、
  单 blocked/两个 blocked、secret scan、禁止上传计数、Chrome worker 缺失、
  cleanup fail-closed）落到
  `stage-b-b5-3-phase0-detailed-plan-2026-10-15.md` + 测试用例；
- 审计报告引用具体文件:行；
- 任一控制分支无审计记录 → Phase 0 不败。

复算命令（独立审查代理可逐条复算）：

```bash
# 检查审计是否覆盖：grep runner 控制分支关键词
grep -nE "fresh isolation|mkdtempSync|secret|upload counter|mute-audio|SIGINT|kill|exit|cleanup|finally|disposition|blocked|chrome" scripts/stage_b_b5_3/run_one_bvid.mjs scripts/stage_b_b5_3/sequencer.mjs > /tmp/runner-audit.txt
wc -l /tmp/runner-audit.txt
```

### PH0-AR-2 单元/契约测试 PASS

- `node --test scripts/stage_b_b5_3/test/contracts.node-test.mjs` 输出
  `# tests 48 / # pass 48 / # fail 0`；
- `node --test scripts/stage_b_b5_3/test/sequencer.node-test.mjs` 输出
  `# tests 11 / # pass 11 / # fail 0`；
- 合计 59/59 PASS。

复算命令：

```bash
node --test scripts/stage_b_b5_3/test/contracts.node-test.mjs
echo "EXITCODE=$?"
node --test scripts/stage_b_b5_3/test/sequencer.node-test.mjs
echo "EXITCODE=$?"
```

### PH0-AR-3 测试纯度

- 测试不启动 Chrome（`grep -E "chromium\.launch|launchPersistentContext" scripts/stage_b_b5_3/test/ -r | wc -l` 期望 0）；
- 测试不启动 Runtime（`grep -E "uvicorn|navia_runtime\.app" scripts/stage_b_b5_3/test/ -r | wc -l` 期望 0）；
- 测试不触发外部网络（所有 `fetch` / `http.get` / `pgrep -af chrome` /
  `ps aux` 不出现在测试中，或仅以 stub 方式出现）；
- 测试不写任何声音（无 `--mute-audio=0`，无 PulseAudio / PipeWire 调用）；
- 测试用 `os.tmpdir()` 沙箱。

复算命令：

```bash
grep -rnE "chromium\.launch|launchPersistentContext" scripts/stage_b_b5_3/test/ || echo "CLEAN_NO_CHROME_LAUNCH"
grep -rnE "uvicorn|navia_runtime\.app" scripts/stage_b_b5_3/test/ || echo "CLEAN_NO_RUNTIME_LAUNCH"
grep -rnE "fetch\\(|http\\.get\\(|pgrep -af chrome|ps aux" scripts/stage_b_b5_3/test/ | grep -v "_fixtures/" || echo "CLEAN_NO_NETWORK"
```

### PH0-AR-4 Stage A 7 分钟超时根因明确

- 根因落 `stage-b-b5-3-phase0-root-cause-2026-10-15.md`；
- 引用 `run_one_bvid.mjs:289-307`（旧轮询逻辑）、
  `task_store.py:197-231`（`reserve_source_authority` 写入 `media_source_authority`）、
  `coordinator.py:307-349`（`MediaAcquisitionCoordinator._create_locked`
  写内存字典而非 `media_tasks`）、`app.py:1365-1380`（`POST
  /v1/media/outline-tasks` 为唯一调用 `MediaTaskStore.create()` 入口）；
- 引用扩展不发 `POST /v1/media/outline-tasks`（`runtimeClient.ts` 仅有
  GET / materialize / cancel / retry 等方法，无 `createMediaOutlineTask` /
  `createOutlineTask` 等 POST 客户端）；
- 修复受 `v3-media-experience-stage-a-fresh.mjs:578, 589-591` 支持
  （working test 已使用 `media_source_authority` 表轮询）。

复算命令（独立审查代理可逐条复算）：

```bash
grep -n "reserve_source_authority" services/local-runtime/navia_runtime/modules/media_companion/task_store.py | head -3
grep -n "INSERT INTO media_tasks" services/local-runtime/navia_runtime/modules/media_companion/task_store.py | head -3
grep -n "/v1/media/outline-tasks" apps/chrome-extension/src/runtimeClient.ts | head -10
```

### PH0-AR-5 最小代码修复在受支持文档范围内

- runner 仅改 `media_tasks` → `media_source_authority` 轮询目标、
  execFileSync try/catch、诊断文案、`expectedRevision: 1`、
  `synthesizeTaskId` 命名替换；
- product code / schema / 合同 / fixtures 不变；
- 6 BVID 固定分母不变；
- 隐私边界（`derivedTextScope = ["transcript","ocr","vision-caption"]`）
  不变。

复算命令：

```bash
git diff --stat scripts/stage_b_b5_3/run_one_bvid.mjs
sha256sum scripts/stage_b_b5_3/run_one_bvid.mjs
# 对比既有 B-5-2 验收 SHA：
# （具体值见 acceptance PH0-AR-5 表）
grep -n "media_source_authority\|media_tasks" scripts/stage_b_b5_3/run_one_bvid.mjs
```

### PH0-AR-6 不启动真实 run

- 本 Phase 0 期间无 `node scripts/stage_b_b5_3/sequencer.mjs --run-id=...`
  被启动；
- 测试与审计不下载任何 bilibili 视频内容；
- 任何 Chrome / Runtime / Provider 上传动作均未发生。

复算命令：

```bash
ls /tmp/navia-b5-3-* 2>/dev/null | wc -l
# 期望：测试沙箱残留（每次测试自动清理），无 Runtime 进程
ps aux | grep -E "uvicorn|navia_runtime" | grep -v grep | wc -l
# 期望：0
```

### PH0-AR-7 不 commit / push

- 工作树存在 untracked 文件
  `scripts/stage_b_b5_3/lib/contracts.mjs`、
  `scripts/stage_b_b5_3/test/contracts.node-test.mjs`、
  `scripts/stage_b_b5_3/test/sequencer.node-test.mjs`、
  `scripts/stage_b_b5_3/test/_fixtures/`；
- `git log scripts/stage_b_b5_3/` 最近 5 条不包含本 Phase 0 提交；
- `git status scripts/stage_b_b5_3/` 列出所有本 Phase 0 新增 / 修改文件。

复算命令：

```bash
git -C /mnt/c/workSpace/navia log --oneline -5 scripts/stage_b_b5_3/
git -C /mnt/c/workSpace/navia status scripts/stage_b_b5_3/
```

## 3. 失败码映射

| 类别 | 本 Phase 0 处置 |
|---|---|
| runner 7 分钟超时（runner state-machine） | 修复后仍签名 `blocked` disposition（与 `allowedFinalDispositions` 一致），但 finishReason 准确记录 `runner state-machine; real bilibili block unconfirmed` |
| 真实 bilibili 访问限制 | 修复后保留 `resolveResponses` 检查，真实 block 仍能被识别 |
| execFileSync transient | 修复后日志 + 继续，不 break sequencer loop |

## 4. 复算命令（独立审查代理出门前逐条复算）

```bash
# (a) 测试 PASS
node --test scripts/stage_b_b5_3/test/contracts.node-test.mjs
echo "EXITCODE=$?"
node --test scripts/stage_b_b5_3/test/sequencer.node-test.mjs
echo "EXITCODE=$?"

# (b) 测试纯度
grep -rnE "chromium\.launch|launchPersistentContext" scripts/stage_b_b5_3/test/ || echo "CLEAN_NO_CHROME_LAUNCH"
grep -rnE "uvicorn|navia_runtime\.app" scripts/stage_b_b5_3/test/ || echo "CLEAN_NO_RUNTIME_LAUNCH"

# (c) 修复受文档支持
grep -n "media_source_authority" apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs
grep -n "media_tasks" apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs

# (d) 不在 product code 中改
git diff --stat services/local-runtime/navia_runtime/modules/media_companion/
echo "EXITCODE=$?"

# (e) 不启动真实 run
ps aux | grep -E "uvicorn|navia_runtime\.app" | grep -v grep | wc -l
# 期望：0
```

## 5. 不允许的验收姿势

- 单元测试 / 合规模型 / 旧产物顶替 Phase 0 真实审计；
- 凭旧 runner 顶替新 runner 状态审计；
- 调短 7 分钟超时掩盖真实根因；
- 在 `media_tasks` 不被写入时仍声称轮询正常；
- 修改 product code 改变轮询行为；
- 在 Phase 0 启动真实 fresh run；
- 替独立审查作最终 PASS。

## 6. 出本验收外的依赖与门禁

- 用户已一次性下达 high-risk 授权覆盖完整 6 BVID fresh run（已在本轮
  session 生效）；
- 用户未授权时，所有证据均按文档 SHA-256 收纳，不含 Chrome 实际启动；
- B-5-3 详细计划 / preimplementation-audit / 验收 / standard plan /
  stop correction 不被本 Phase 0 改动；
- `stage-b-six-video-registry.json` v1 哈希冻结不被本 Phase 0 改动；
- B-5-4 / B-5-5 / B-5-6 / B-5-7 仍需独立 Claude Code CLI 复算后单独出门；
- B-6 / B-7 / Stage C / D / E / V3-6 / V3-7 / Chat / Know 仍未启动。

## 7. Phase 0 出门后衔接

- Phase 0 出门 → Phase 1（B-5-3 真实六视频 fresh run），且新跑前必须先
  解决：
  1. 复用 `v3-media-experience-stage-a-fresh.mjs:340-372` 的
     `media-companion-enable` 点击 + X11 ctypes fake-click native prompt
     处理；
  2. 在 runner 调 synthesize 前先调 `POST /v1/media/outline-tasks`
     创建 `media_tasks` 行；
- Phase 1 跑通后 → B-5-4 → B-5-5 → B-5-6 → B-5-7 → B-6/B-7 → Stage C/D/E
  → V3-6/V3-7；
- Phase 0 任何代码修改、测试、PRD 检视、handoff 均不 commit / push；
- 本会话不替独立审查作最终结论。

## 8. 最新补充验收门槛

以下门槛优先于旧复算命令和旧 canary 假设：

1. outline 响应解析必须接受 Runtime 公共 camelCase `taskId`；若同时出现 camel/snake 且值冲突，必须 fail-closed。
2. `POST /v1/media/outline-tasks` 返回的 task ID 必须与当前 source authority 完全一致。
3. `created -> materialize -> ready|degraded` 必须由产品/Runtime 的唯一编排者真实完成；runner 只触发和观测。
4. 下一 canary 必须使用 `--mute-audio`、真实 Runtime `17861`、临时扩展 fixture 与最低必要私有 Cookie，且公开 evidence 的 Cookie 值/私有路径命中为 0。
5. canary 成功后仍需真实 crash/worker/permission/cleanup failure 证据和独立 Fatal=0/Major=0；缺任一项，P0 不出门。

最新失败 run `/tmp/navia-b5-3-canary-1792053808072` 只能证明前置链路和 fail-closed cleanup，不能证明 Stage A terminal。

## 9. 当前权威验收补丁

1. 成功 canary 必须由可见产品控件完成 trusted capture；API 伪造 grant、直接 materialize、直接写库均为 Major。
2. acquisition 必须先到 `succeeded`，随后网络/UI 证据证明 Side Panel effect 发出 materialize；outline task 最终为 `ready|degraded`，`created` 不通过。
3. authority、acquisition、outline、Workspace 必须为同一 task ID/revision；visual fallback 只能由同一产品 effect 触发。
4. 最新 run `/tmp/navia-b5-3-canary-1792055036947` 为有效失败：`stage-a-not-terminal`、exit 1、cleanup failure 0、Cookie leak 0。它不构成 PASS。
5. Chrome 必须始终 `--mute-audio`；任何可听声音、raw media/secret/path hit 或 cleanup failure 均为 Fatal。

# Stage B B-5-3 自动化恢复 addendum（撤销对人工导航的依赖，2026-10-14）

日期：2026-10-14。本 addendum 与 `stage-b-b5-3-detailed-plan-2026-10-14.md` 同级落盘，
**不撤回** 原计划任何 AR-1..AR-12 / §3 风险闭环 / §6 处置，**只**对原计划附录
§"实施步骤的预备条件"作工程层补全：将"用户在 Windows Chrome 手动加载扩展 + 手动
导航至 6 BVID"改为"由新 runner `scripts/stage_b_b5_3/run_one_bvid.mjs` 在 WSL/Chrome
for Testing 链路全自动完成"。两条路径在验收门槛上完全等价。

## 1. 与原 detailed plan 的不冲突声明

本 addendum 与下列文件互不冲突：

- `stage-b-b5-3-detailed-plan-2026-10-14.md`（执行策略、单 BVID 一次性计划、
  落地形态）；除 §"步骤 1 启动脚本放置"由本 addendum §3 指定的新 runner 替换外，其余
  §1..§12 全部沿用。
- `stage-b-b5-3-acceptance-2026-10-14.md`（验收门槛 AR-1..AR-12）。
- `stage-b-b5-3-preimplementation-audit-2026-10-14.md`（实施前审计）。
- `stage-b-b5-3-stop-report-correction-2026-10-14.md`（事实勘误，指向本 addendum）。

新增/修改清单：

- 新增：`scripts/stage_b_b5_3/run_one_bvid.mjs`（B-5-3 fresh 自动化 runner）；
- 新增：`scripts/stage_b_b5_3/sequencer.mjs`（6 BVID 顺序串联 driver）；
- 不修改 product code；不修改 `quality.py` / `service.py` / `synthesis.py`；
- 不修改合同 schema；不修改 verifier；不修改 stage B V2/V2.1 派生逻辑；
- 不修改 B-5-3 detailed plan / acceptance 任何 AR-*。

## 2. 工程层补全：B-5-3 不依赖人工操作的证据路径

冻结六 BVID（D-1..D-6）将被本 runner 在 6 轮 iter 中**自动**完成：

| iter | BVID | 来源：原 detailed plan §步骤 5 |
|---:|---|---|
| D-1 | BV1pohR6rEEh | … |
| D-2 | BV1hMpE6FEXG | … |
| D-3 | BV1VHHe6kEH3 | … |
| D-4 | BV1SDHy6aEiB | … |
| D-5 | BV1vSHD6tEsM | … |
| D-6 | BV1FCps68EGf | … |

每轮 iter BVID 由 runner **顺序**处理，不复用任何 round 的 Runtime / sqlite /
chrome-profile / task_id。中间产物互不覆盖。

## 3. 新 runner 的事实基础（本仓库已落盘脚本）

`scripts/stage_b_b5_3/run_one_bvid.mjs` 复用的既有代码：

| 步骤 | 复用源 | 文件:行 |
|---:|---|---|
| Windows Chrome 启动 + `--mute-audio` + `--load-extension` + `--disable-extensions-except` + 独立 `user-data-dir` + 随机 remote-debugging-port | `launchExtension()` | `apps/chrome-extension/e2e/chrome-v2-t01-r1-frontend.mjs:180-258` |
| Chromium CDP 接入（per-iter 独立 browser context） | `chromium.connectOverCDP()` | 同上 209-211 |
| 扩展 service worker 查询 + extensionId 解析 | `extensionWorker()` | 同上 269-282 |
| Runtime companion 启动 + `waitForRuntime()` + env 注入 + `NAVIA_DB_PATH` / `NAVIA_MEDIA_TASK_ROOT` / `NAVIA_LOCAL_FILES_EXTENSION_ID` | `startRuntime()` + `waitForRuntime()` | `apps/chrome-extension/e2e/v3-5.1-production-candidate-e2e.mjs:70-86`；`apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs:50-60, 286-313` |
| BVID → `goto("https://www.bilibili.com/video/<bvid>")` 自动导航 + 触发浮动 launcher → 创建 `media_task_<32hex>` | inline porting | `apps/chrome-extension/e2e/v3-media-experience-stage-a-fresh.mjs:329-394` |
| Stage A 等待 ready 状态 + transcript preview | inline porting | 同上 484-587 |
| Workspace 调 "允许并生成" → 触发 Stage B synthesize | inline porting | 同上 778-849 |
| V2.1 派生落盘读出 + receipt 11 字段读出 | inline porting | 同上 813-845 |
| BVID 完成 → Chrome kill + profile rm + runtime kill + tmp rm | inline porting | 同上 1073-1081 |
| Per-iter 隔离 evidence 落盘（isolation.json / cleanup.json / chrome_launch.log / provider_lock.txt / final_disposition.txt / secret_scan.csv） | runner 自身实现 | 新文件 §4 |

不重写 Stage A 工作流（已经过大量测试），不重写 Stage B 合成器（已通过 B-5-2 验收）。
本 addendum 不引入新的扩展权限、不引入新的 Runner Python 代码、不引入新的 Provider
实现、不引入新的合成 style。

## 4. 新 runner 必备产出

每个 BVID 必须落盘到 `/mnt/c/workSpace/navia/docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-3-evidence/<runId>/bvid-<order>-<bvid>/`：

1. `<bvid>-evidence.json` — V2.1 派生镜像；schemaVersion=`v3-media-grounded-comprehension/v2.1`；
2. `receipt.json` — V2.1 receipt 镜像，含 4 原始字段 + 7 extras = 11 字段；
3. `isolation.json` — fresh isolation 指纹（runtimePid / runtimeDir / databasePath /
   chromeProfileDir / chromePidList / chromeLaunchLineSha256 / taskIdNamespace /
   providerLock / derivedTextScope / startedAtUtc / finishedAtUtc / finalDisposition）；
4. `cleanup.json` — 进程 / 临时文件 / chrome profile / cookie jar 清理证据；
5. `secret_scan.csv` — 6 PATTERN 扫描 0 命中；
6. `chrome_launch.log` — Chrome 启动命令行 + PID + 校验 `--mute-audio` 通过；
7. `provider_lock.txt` — Settings dump + 锁定声明（`providerLock == "minimax_chat_completions"` + DeepSeek 不启用）；
8. `final_disposition.txt` — `complete` / `limited` / `blocked` / `failed` 四选一；
9. `task_namespace.json` — task_id 命名空间（与既有 .navia/media-tasks/ 不重号）；
10. `stage_a_to_b_trace.json` — Stage A 等待 ready → Stage B synthesize 调用 trace。

不落盘上述任一项即 BVID `failed`。final disposition 计数：

- `complete`：V2.1 receipt 11 字段齐全 + 6 upload counters 全 0 + secret_scan.csv
  0 命中 + finalization 全部保存；
- `limited`：V2.1 派生落盘但 brief 来自 composer（brief.origin=`deterministic_claim_composer`）；
- `blocked`：transcript 抓取被 bilibili 拒绝 / 视频不可访问 / Runtime 返回
  `V3510B_BVID_ACCESS_BLOCKED`；留分母不替换；
- `failed`：其他任一阻断。

## 5. 上传范围硬编码

- `derivedTextScope = ["transcript","ocr","vision-caption"]`（与原 detailed plan §4 步骤 0 一致）；
- Provider 入参：仅 `evidence[]` 中每个条目的 `evidenceId / kind / timestampStartMs /
  timestampEndMs / text`；不传任何原始字节 / cookie / API key / 本地路径 / secret path；
- `rawVideoUploadCount / rawAudioUploadCount / frameByteUploadCount /
  cookieUploadCount / apiKeyDisclosureCount / localPathUploadCount` 全部 hard-coded 0
  （provider 客户端不持有原始 bytes，也即天然为 0，runner 仅做二次断言）。

## 6. STOP 触发（与原 detailed plan §3 + §9 完全一致，本 addendum 不新增 STOP 类别）

- ≥2 个 `blocked` → 整 B-5 FAIL / REPLAN；
- 任一 BVID 启动行缺少 `--mute-audio` → STOP；
- 任一 BVID 6 upload counters 非 0 → STOP；
- 任一 BVID secret scan 命中 → STOP；
- 任一 V2 / V1 历史字节改动 → STOP；
- 任一 product code SHA-256 与 B-5-2 验收时不一致 → STOP；
- 任一 BVID 失败 1 次 retry 后仍未通过 → STOP。

## 7. AR-* 对应表（自动化映射）

| AR | 满足方式 |
|---|---|
| AR-1 6 BVID 全部 `attempt_fresh` | runner iter 顺序处理 6 个 BVID |
| AR-2 独立 task/Runtime/DB/chrome-profile 命名空间 | runner 每 iter 用 `mkdtempSync` / `crypto.randomUUID()` 全新生成 |
| AR-3 Chrome `--mute-audio` | 复用 `launchExtension()` 第 188 行 `["--mute-audio"]` 默认开启 |
| AR-4 0 原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径上传 | provider 客户端天然不持有；runner 二次断言 6 upload counters = 0 |
| AR-5 V2.1 schema meta-validation PASS | runner 不动 schema；既有 `verify-stage-b-route-2-contract-fixtures.py` 持续跑 |
| AR-6 单任务仅一个权威 Provider | runner 不切 Provider；Default = `minimax_chat_completions`；DeepSeek 任务级不启用 |
| AR-7 composer 仅两 allowlisted code | product code 不动；既有 `service.py` 已固化 |
| AR-8 V2.1 atomic publish + 0o600 | product code 不动；runner 落盘 mode `0o600` |
| AR-9 65 unit test PASS | runner 不动 test 文件；既有 pytest 持续 PASS |
| AR-10 product code SHA 不变 | runner 不写 product code；SHA 不变 |
| AR-11 分母与 blocked 计数 | runner 输出每 BVID disposition，≥2 blocked 触发 STOP |
| AR-12 失败 / 取消 / 重启清理 | runner finally 块 `pkill` Chrome + `rmSync` runtime_dir + 写 cleanup.json |

## 8. 不删除 / 不覆盖原 STOP 报告

- 原 STOP 报告保留在 `docs/.../stage-b-b5-3-stop-report-2026-10-14.md`；
- 本 addendum 与更正文件同级，不动原 §1..§7；
- 自动化恢复完成后，runner 输出 `/stage-b-b5-3-acceptance-evidence-<runId>.md`
  作为 B-5-3 acceptance 的入口。

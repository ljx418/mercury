# Stage B B-5-3 详细开发计划（真实 fresh 6 BVID 分母，2026-10-14）

日期：2026-10-14。本子阶段承接 B-5-2（DEV-3 单任务 Composer 接收与原子发布）出门，
实施 B-5 recovery dev plan §5 的 **DEV-4 真实 fresh 6 视频分母**。本计划只冻结 B-5-3
执行策略、单 BVID 一次性计划与每 BVID 落地形态。本轮 session 用户授权已一次性覆盖
冻结六 BVID 的完整 fresh run（详见 §7 / §9），不要求也不允许在每个 BVID 前再次
等待用户开关；每 BVID 仍须遵循 §4 步骤 0 自检 + §3 STOP 触发条件。

## 1. 范围与不扩展

- 范围：
  - 6 个 BVID 各自 fresh Runtime / database / chrome-profile / task 命名空间；
    6 个 task ID 互相不同且与既有 run 不重号；
  - 单任务单 Provider；本子阶段默认 **MiniMax**（B-5-3 期间不启用 DeepSeek 任务级路径，
    详见 §11 推荐项说明）；
  - 每个 Chrome 实例显式带 `--mute-audio`，Xvfb 单独不视为静音；
  - 仅发送授权范围内派生 transcript / OCR / vision-caption 文本；
    **不**上传原始视频 / 原始音频 / 帧 / Cookie / API key / 本地路径 / 本地 secret path；
  - 失败 / 取消 / 重启 / 进程退出 / 路径异常 / cookie 异常 / 页异常 / lease 失效
    必须 Traceback 流程可复算；临时媒体 / cookie / token / profile / 残留在退出后被清理；
  - 全部完成后每个 BVID 写入独立产物
    `<private>/grounded-comprehension-v2.1/<taskId>/revision-<revision>/<catalogHash>.json`
    + receipt（含 11 字段 V2.1 extras）+ provider list + 6 上传计数（hard-coded 0）
    + secret scan 0 命中 + fresh isolation 指纹（Runtime 进程号 / DB path /
    chrome-profile path / task namespace）。
- 不扩展：B-5-4（清理与汇总）/ B-5-5（closure）/ B-5-6（handoff）/ B-5-7
  （external-audit-package）/ B-6（宿主语义）/ B-7（独立实施出门）/ Stage C / D / E
  / V3-6 / V3-7 / 跨 Provider 拼接 / 最佳 N 选一 / 隐式 fallback / 阈值降低 /
  凭旧 run 顶替 fresh run / SecretStore 兼容列回填 / SecretStore 反向兼容
  / `--mute-audio` 之外的真实音频 / 任何 HTTP 502 之外的状态码调整。

## 2. 验收门槛（只对本子阶段）

| ID | 描述 | 门槛 |
|---|---|---|
| AR-1 | 6 BVID 全部 `attempt_fresh` | 6 个 BVID 都各自一次 fresh run；`stage-b-six-video-registry.json v1` 哈希匹配；不存在从分母移除或替换 |
| AR-2 | 独立 task / Runtime / database / chrome-profile 命名空间 | 6 个 task ID 互不相同、与既有 run 不重号；每个 BVID 都有独立 Runtime 进程号、DB path、profile path |
| AR-3 | `--mute-audio` Chrome 实例 | 6 个 Chrome 实例启动行都含 `--mute-audio`；Xvfb 单独不视为静音；本机无真实音频发声 |
| AR-4 | 0 原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径上传 | 6 个 V2.1 receipt 中 6 upload counters 全 0；`receipts/secret_scan_*.csv` 中 `plaintext_present` 列全 0；receipts 中 `BAD` regex 0 命中；SQLite 中 6 PATTERN 全 0 命中 |
| AR-5 | V2.1 schema meta-validation 仍 PASS | `verify-stage-b-route-2-contract-fixtures.py` 输出 `schemaMeta: PASS` / `positiveInstances: 3/3 PASS` / `schemaNegatives: 5/5 PASS` / `registry: 11/11 present` |
| AR-6 | 单任务仅一个权威 Provider | 每个 task receipt 仅含 1 个 `providerId`；不允许 0 或 ≥2；Chat 默认 MiniMax 不变；DeepSeek 不启用（本子阶段） |
| AR-7 | composer 仅在两 allowlisted code 触发 | `V3510B_BRIEF_LENGTH_INVALID` / `V3510B_BRIEF_RAW_PREFIX` 之外的失败不进入 composer；其他失败仍返回原始 provider 失败 |
| AR-8 | V2.1 atomic publish + 历史字节 | V2.1 写入 mode `0o600`；commit 前 authority 屏障拒绝 revision / catalog 漂移；V2/V1 字节不被改写 |
| AR-9 | 单元测试持续 PASS | `test_v3_grounded_comprehension_b5_1.py` 12 passed + `test_v3_grounded_comprehension_b5_2.py` 9 passed + `test_v3_grounded_comprehension_v2.py` 10 passed + `test_v3_media_comprehension.py` 28 passed + `test_v3_companion_runtime.py` 6 passed = 65/65 |
| AR-10 | B-5-3 期间 product code 不动 | quality.py / service.py / synthesis.py SHA 与 B-5-2 验收时一致；V2 schema SHA 与 M-B5-1-01 关闭时一致；V2.1 schema / fixtures / verifier / addendum SHA 与 M-B5-1-01 关闭时一致 |
| AR-11 | 分母与 blocked 计数 | ≥2 个 `blocked` → B-5 FAIL / REPLAN；最多 1 个 `blocked` 仍可出门；任一 BVID 失败 1 次 retry 后仍未通过即整 B-5 FAIL/REPLAN |
| AR-12 | 失败 / 取消 / 重启清理 | 临时 media / cookie / token / profile / Chrome 进程 / Runtime 进程退出后全清零；状态可解释 |

## 3. 风险闭环

| 风险 | 闭环 |
|---|---|
| 跨 BVID 复用 Runtime / DB / chrome-profile | 每个 BVID 在启动脚本生成独立 Runtime 子目录、独立的 SQLite 文件、独立的 chrome-profile 目录；启动记录 Runtime PID + sqlite path + profile path，写入 BVID receipt 同目录下的 `isolation.json` |
| Chrome 静默开启音频 | 每个 Chrome 实例启动行固定追加 `--mute-audio`；审计脚本扫所有 Chrome 启动 trace 含 `--mute-audio`；如缺失立刻 STOP |
| 单任务被切换 Provider | Settings 在 B-5-3 启动前显式锁定 MiniMax；`synthesis_provider_factory` 调用次数 ≤ 1 / synthesize；任务级 receipt `providerId == "minimax_chat_completions"` |
| 真实项目派生文本被外发 | 仅在 `authorizationScope.derivedTextUpload = ["transcript","ocr","vision-caption"]` 三类内；其余任何字段不允许出现在 Provider 入参；`raw_video_bytes / raw_audio_bytes / raw_frame_bytes / cookie / api_key / local_path` 入参零容忍；6 upload counters 全 hard-coded 0 二次校验 |
| 凭旧产物顶替 | 每 BVID 启动前比对 `grounded-comprehension-v2.1/<taskId>/` 是否存在；已存在 → 启动失败并 STOP（fresh isolation 硬性要求） |
| DeepSeek 任务级启用未授权风险 | 本子阶段默认 MiniMax，DeepSeek 在 B-5-3 期间不启用（详见 §11） |
| BVID 真实访问性差异 | 真实访问失败 → 标 `blocked`，必须留在分母且不替换；`allowedFinalDispositions = ["complete","limited","blocked","failed"]`；`maximumBlockedForStageExit = 1`；`substitutionAllowed = false` |
| secret 泄漏 | MR-06 (a)-(d) 4 条复算命令每个 BVID 落盘后由独立审查代理逐条复算；任一命中即 STOP |
| 进程残留泄漏 cookie / token / profile | 每个 BVID 退出后强制 `chrome-process-cleanup` + `profile-dir-rm -rf` + `runtime-tmp-rm -rf` + `cookie-tmp-rm -rf`；B-5-4（清理）单独再核 |

## 4. 详细实施步骤

### 步骤 0 — 启动前置（每个 BVID 实例启动前必逐条自检）

- [ ] 本轮 session 用户已一次性下达授权覆盖完整 6 BVID fresh run（详见 §7 / §9；
      不再等待每 BVID 单独开关）；
- [ ] `provider_settings.chatProviderSelection = "minimax_chat_completions"` 且 `deepseek.selected = false`；
- [ ] 每个 BVID 实例使用独立 Runtime 子目录（`/tmp/navia-b5-3-<order>-<bvid>-<uuid>/`）、
      独立 SQLite 文件（`<runtime>/navia-<order>.sqlite3`，mode 0o600）、
      独立 chrome-profile 目录（`<runtime>/chrome-profile/`，mode 0o700）；
- [ ] Chrome 启动命令行片段固定包含 `--mute-audio`；
- [ ] 启动前对 `<private>/grounded-comprehension-v2.1/<taskId>/` 做 `ls`，
      若目录已存在 → STOP，标记 fresh-isolation-violation；
- [ ] 启动前清理上一个 BVID 的临时目录（防御性，无旧 BVID 时 no-op）；
- [ ] 上传 scope 写死 `["transcript","ocr","vision-caption"]`；
- [ ] 不读 `dsKey.txt`；不读 `~/.deepseek/api_key` 等明文 key 文件；
- [ ] 收件人仅 `MiniMaxGroundedSynthesisProvider`；不调用 DeepSeek strict provider。

### 步骤 1 — B-5-3 harness 启动（一次性，6 BVID 共用同一份脚本）

启动脚本放置：
- `scripts/stage_b_b5_3/run_one_bvid.py`（不在 product code 路径，证据保存到
  `stage-b-b5-3-evidence/` 子目录）；
- 每个 BVID 实例化参数 `bvid`、`task_id_namespace`、`runtime_dir`、`db_path`、
  `chrome_profile_dir`、`provider_lock = "minimax_chat_completions"`、`derived_text_scope = ["transcript","ocr","vision-caption"]`。

启动脚本固定动作：
1. `mkdir -p <runtime_dir>` mode 0o700；
2. `sqlite3 <db_path> ".pragma key=''"` 创建空 DB（mode 0o600）；
3. Chrome launch：`<chrome-bin> --headless=new --no-sandbox --disable-gpu --mute-audio
   --user-data-dir=<chrome_profile_dir> --remote-debugging-port=<port>
   about:blank &`，立即 `pgrep -af <chrome-bin> | grep -- '--mute-audio'`
   校验；
4. 启动 Runtime 子进程（`python3 -m navia_runtime.media_companion_runtime --runtime-dir=<runtime_dir>`），
   记录 PID + 启动时间戳（UTC）+ 启动行 SHA-256；
5. 通过 Runtime 派发 `media_companion.comprehension.synthesize_v2`，参数
   `bvid=<bvid>` + `task_id=<uuid>` + `primary_provider=minimax_chat_completions`；
6. 等待 Runtime 返回 V2.1 落盘路径；如失败 → retry 一次，仍失败 → 标 failed 不再 retry；
7. 进程退出后清理（详见步骤 4）。

### 步骤 2 — 单 BVID 产物清单（每 BVID 必产生）

落到 `<private>/grounded-comprehension-v2.1/<taskId>/revision-<r>/<catalogHash>.json`：

1. `grounded-comprehension-v2.1/<taskId>/revision-<r>/<catalogHash>.json`（V2.1 schema 实例）：
   - `schemaVersion = "v3-media-grounded-comprehension/v2.1"`；
   - `receipt` 含 4 原始字段 + 7 extras = 11 字段；
   - `providerList` 仅 1 个 Provider；
   - 6 upload counters 全 0；
   - 文件 mode `0o600`；
   - sha256(写入后字节) 记录。

2. `<taskId>/receipt.json`：V2.1 receipt 镜像（便于独立审查代理复算）。

3. `<taskId>/isolation.json`：
   - `runtimePid`（实际 Runtime 进程号）；
   - `runtimeDir`（独立 runtime 子目录绝对路径）；
   - `databasePath`（独立 SQLite 文件绝对路径，sha256 文件 mode）；
   - `chromeProfileDir`（独立 chrome-profile 目录绝对路径）；
   - `chromePidList`（启动时所有 Chrome 子进程 PID）；
   - `chromeLaunchLineSha256`（Chrome 启动命令行 SHA-256，含 `--mute-audio`）；
   - `taskIdNamespace`（独立 task 命名空间 ID）；
   - `providerLock`（锁定 Provider：`minimax_chat_completions`）；
   - `derivedTextScope`（锁定上传范围：`["transcript","ocr","vision-caption"]`）；
   - `startedAtUtc` / `finishedAtUtc`；
   - `finalDisposition`（`complete` / `limited` / `blocked` / `failed`）。

4. `<taskId>/secret_scan.csv`：6 PATTERN 扫描结果（`provider, vault_ref_present, plaintext_present`），
   `plaintext_present` 必须全 0。

5. `<taskId>/cleanup.json`：进程 / 临时文件清理证据（详见步骤 4）。

### 步骤 3 — 每 BVID 落盘后独立审查代理必跑的复算命令

```bash
# (a) SQLite 中无明文 API key（MR-06 a）
python3 - <<'PY'
import sqlite3, glob, re
PATTERNS = [r"sk-[A-Za-z0-9_\-]{16,}", r"sk_live_[A-Za-z0-9]{8,}",
            r"AIza[0-9A-Za-z_\-]{16,}", r"gho_[A-Za-z0-9]{16,}",
            r"deepseek-[A-Za-z0-9]{8,}", r"minimax-[A-Za-z0-9]{8,}"]
hits = []
for db in glob.glob("<runtime_dir>/**/*.sqlite3", recursive=True) + glob.glob("<runtime_dir>/**/*.db", recursive=True):
    try:
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    except Exception:
        continue
    try:
        for (name,) in con.execute("SELECT name FROM sqlite_master WHERE type='table'"):
            try:
                rows = con.execute(f'SELECT * FROM "{name}"').fetchall()
            except Exception:
                continue
            for row in rows:
                blob = "\n".join(str(c) for c in row)
                for pat in PATTERNS:
                    if re.search(pat, blob):
                        hits.append((db, name, pat))
    finally:
        con.close()
print("HITS" if hits else "CLEAN")
PY

# (b) 接收层 0 命中（MR-06 b）
python3 - <<'PY'
import glob, re
BAD = re.compile(r"(cookie|secret|api[_-]?key|bearer|local[_-]?path|/etc/|/root/|dsKey\.txt|\.bilibili\.com/cookie|raw[-_]?video|raw[-_]?audio|raw[-_]?frame)", re.I)
files = glob.glob("<evidence_root>/receipts/**/*.json", recursive=True) + glob.glob("<evidence_root>/**/*receipt*.json", recursive=True)
hits = [(f, m.group(0)) for f in files for line in open(f, encoding="utf-8", errors="ignore") for m in BAD.finditer(line)]
print("HITS" if hits else "CLEAN")
PY

# (c) V2.1 derivative 落盘形态
python3 - <<'PY'
import hashlib, json, pathlib
root = pathlib.Path("<evidence_root>/private/grounded-comprehension-v2.1")
files = list(root.rglob("*.json"))
for path in files:
    value = json.loads(path.read_text(encoding="utf-8"))
    rcpt = value.get("receipt", {})
    counters = [rcpt[k] for k in (
        "rawVideoUploadCount", "rawAudioUploadCount", "frameByteUploadCount",
        "cookieUploadCount", "apiKeyDisclosureCount", "localPathUploadCount"
    )]
    assert all(c == 0 for c in counters), f"upload counters nonzero: {path}"
    assert value.get("schemaVersion") == "v3-media-grounded-comprehension/v2.1"
    assert path.stat().st_mode & 0o777 == 0o600
print("CLEAN")
PY

# (d) Chrome --mute-audio 校验
grep -l -- '--mute-audio' <evidence_root>/isolation_*.json | wc -l   # 期望 ≥ 6
```

任一项不达即 STOP；不允许"只跑完部分分母"。

### 步骤 4 — 进程与临时文件清理（每 BVID 退出前）

1. `pkill -f <chrome-bin> --user <user> || true`；
2. `rm -rf <chrome_profile_dir>`；
3. `pkill -f "navia_runtime.media_companion_runtime --runtime-dir=<runtime_dir>" || true`；
4. `rm -rf <runtime_dir>/tmp`；
5. 写入 `<taskId>/cleanup.json` 含 `cleanupAtUtc` + 5 步退出证据（before/after stat / sha256）。

### 步骤 5 — 6 BVID 串联执行

固定顺序（与 `stage-b-six-video-registry.json` v1 一致）：

| order | bvid |
|---:|---|
| 1 | BV1pohR6rEEh |
| 2 | BV1hMpE6FEXG |
| 3 | BV1VHHe6kEH3 |
| 4 | BV1SDHy6aEiB |
| 5 | BV1vSHD6tEsM |
| 6 | BV1FCps68EGf |

每 BVID 严格按 步骤 0 → 1 → 2 → 3 → 4 流程执行；前一 BVID 未通过验收则下一 BVID 不启动；
任一 BVID 失败 1 次 retry 后仍未通过即整 B-5 FAIL / REPLAN。

## 5. 失败码映射（B-5-3 接收边界）

| code | 触发 | 接收门 |
|---|---|---|
| `V3510B_PROVIDER_UNAVAILABLE` / `V3510B_PROVIDER_TIMEOUT` / `V3510B_PROVIDER_RESPONSE_INVALID` | 5xx / 网络 / 解析失败 | 1 次 retry，仍失败 → 当前 BVID 标 `failed`，B-5 FAIL/REPLAN |
| `V3510B_PROVIDER_REFUSAL` / `V3510B_PROVIDER_AUTHORIZATION_DENIED` | 401 / 403 / refusal | 不进 repair / composer；当前 BVID 标 `failed`；同 retry 策略 |
| `V3510B_BRIEF_LENGTH_INVALID` / `V3510B_BRIEF_RAW_PREFIX` | brief 归一化后 ≠ [20,100] / brief 是 transcript 原文前缀 | 触发 `repair_v2` 一次，仍失败触发 composer；无闭合子集保留原 code + 内部诊断 |
| `V3510B_CLAIMS_*` / `V3510B_CHAPTERS_*` / `V3510B_AUTHORITY_*` | claims / chapters / authority 失败 | fail-closed；不进 composer；当前 BVID 标 `failed` |
| `V3510B_PROVIDER_UNQUALIFIED` / `V3510B_PROVIDER_AUTHORIZATION` | Provider 未授权 / 未能力测试 | fail-closed；当前 BVID 标 `failed` |
| `V3510B_BVID_ACCESS_BLOCKED` | BVID 访问受限 | 当前 BVID 标 `blocked`（保留在分母） |
| `V3510B_COMPOSER_NO_VALID_SUBSET` | composer 未找到合格 subset | 内部诊断；HTTP 层返回原 brief 失败 |

## 6. 风险与不达预期处置

- 任何 BVID `blocked` ≥ 2 → 整 B-5 FAIL / REPLAN（与 `stage-b-six-video-registry.json v1 maximumBlockedForStageExit=1` 一致）；
- 任一 BVID 真实 fresh run 产物落到其他 BVID 的命名空间 → STOP，标记 fresh-isolation-violation；
- 任一 BVID 启动 trace 不含 `--mute-audio` → STOP，标记 mute-audio-violation；
- 任一 BVID 6 upload counters 非 0 → STOP，标记 raw-upload-violation；
- 任一 BVID secret scan 命中 → STOP，标记 secret-leak；
- 任一 BVID HTTP status ≠ 502 → STOP，标记 http-status-drift；
- 任一 BVID 失败 1 次 retry 后仍未通过 → STOP，标记 bvid-failed-after-retry；
- 任一 BVID V2/V1 历史字节改动 → STOP，标记 byte-drift。

## 7. 出本计划的依赖

- B-5-1 验收 PASS（`stage-b-b5-1-acceptance-2026-10-14.md`）；
- B-5-2 验收 PASS（`stage-b-b5-2-acceptance-evidence-2026-10-14.md`）；
- M-B5-1-01 已闭合（`stage-b-b5-1-m-b5-1-01-closure-2026-10-14.md`）；
- 独立实施审查结论（`independent-b5-1-b5-2-implementation-audit-2026-10-14.md`）已落盘
  B-5-3 READINESS CONDITIONAL PASS；
- 用户已在本 session 内对完整 B-5-0..B-5-7、固定六视频 fresh run、任务级临时
  DeepSeek 选择及派生 transcript / OCR / vision-caption 文本上传下达授权；
  原始视频 / 音频 / 帧 / Cookie / API key / 本地路径仍禁传；Chrome 必须 `--mute-audio`；
- MiniMax 默认 Chat Provider 不被本子阶段改动；
- DeepSeek 任务级启用本子阶段不使用（详见 §11）；
- 65 项 pytest 仍 PASS；V2.1 verifier 仍 PASS。

## 8. 6 BVID fresh run 启动策略（与 B-5 recovery dev plan §5 DEV-4 一致）

- 每个 BVID 实例在启动前完成 §4 步骤 0 自检；
- 不复用旧产物：`<private>/grounded-comprehension-v2.1/<taskId>/` 已存在即 STOP；
- 每个 BVID 实例的 Runtime / DB / chrome-profile / task 命名空间指纹记录到
  `<taskId>/isolation.json`；
- 每个 BVID 实例的 V2.1 产物路径与 receipt 11 字段 + 6 upload counters=0 由
  独立审查代理在下一 BVID 启动前逐项复算。

## 9. 启动权限与 STOP 触发

- 启动权限：本轮 session 用户已一次性授权覆盖完整 6 BVID fresh run；不在每个
  BVID 前再次等待用户开关；不在 product code 中预埋自动启动；执行序列由本子阶段
  步骤 5 串联执行；
- STOP 触发（任一即停，立即终止后续 BVID + 保留可复算证据 + 报告 STOP 原因）：
  1. `blocked` BVID 数 ≥ 2；
  2. 任何禁止数据上传（原始视频 / 音频 / 帧 / Cookie / API key / 本地路径 / dsKey.txt）；
  3. 任何 Chrome 实例缺少 `--mute-audio`；
  4. 任何 BVID 6 upload counters ≠ 0；
  5. 任何 secret scan 命中；
  6. 任何 HTTP 502 路径漂移；
  7. 任何 V2 / V1 历史字节改动；
  8. 任何 product code SHA-256 与 B-5-2 验收时不一致；
  9. 任何 cross-run 复用产物（旧产物路径被新 task 覆盖）；
  10. 任何失败 1 次 retry 后仍未通过。

## 10. 实施步骤的可复算证据保存

每 BVID 落盘后保存：

- `<evidence_root>/bvid-<order>-<bvid>/receipt.json`（V2.1 receipt 镜像）；
- `<evidence_root>/bvid-<order>-<bvid>/isolation.json`（fresh isolation 指纹）；
- `<evidence_root>/bvid-<order>-<bvid>/cleanup.json`（清理证据）；
- `<evidence_root>/bvid-<order>-<bvid>/secret_scan.csv`（独立审查代理 4 条复算
  命令的输出）；
- `<evidence_root>/bvid-<order>-<bvid>/chrome_launch.log`（Chrome 启动命令行 +
  PID + `--mute-audio` 校验输出）；
- `<evidence_root>/bvid-<order>-<bvid>/provider_lock.txt`（Provider 锁定声明 +
  Settings 状态 dump）；
- `<evidence_root>/bvid-<order>-<bvid>/final_disposition.txt`（`complete` /
  `limited` / `blocked` / `failed` 四选一 + 触发原因）。

最终汇总到 `stage-b-b5-3-acceptance-evidence-2026-10-14.md`。

## 11. 推荐项（非阻断）：DeepSeek 重写路径 401/403 翻译对齐

`independent-b5-1-b5-2-implementation-audit-2026-10-14.md §8` 额外观察指出：

> `synthesis.py` DeepSeek strict provider `_complete_once` 重写路径 line 975-976
> 仅对非 401/403 HTTPStatusError 抛 `V352_SYNTHESIS_PROVIDER_UNAVAILABLE`；
> 401/403 在 MiniMax 路径下被显式翻译为 `V352_SYNTHESIS_CREDENTIAL_REGION_MISMATCH` →
> `V3510B_PROVIDER_AUTHORIZATION_DENIED`，DeepSeek 重写路径未对齐。

本子阶段 **不启用** DeepSeek 任务级（默认 MiniMax），因此本子阶段不触发该缺口；
若 B-5-3 之后有 BVID 需要 DeepSeek 任务级启用，必须先在 DeepSeek 重写路径下补
401/403 翻译，并在 `stage-b-b5-recovery-preimplementation-audit.md §1` 追加 product
code SHA-256 变更说明。

## 12. B-5-3 出门后 → B-5-4..B-5-7 衔接

- B-5-3 出门后进入 B-5-4（清理与汇总独立审查）→ B-5-5（closure 包）→ B-5-6（handoff
  到 B-6 宿主语义）→ B-5-7（canonical audit package ≤ 20 文件）；
- 不进入 B-6 / B-7 / Stage C / D / E / V3-6 / V3-7；
- 不 commit / push；
- 不替独立审查作最终结论。

# Stage B B-5-3 验收标准（真实 fresh 6 BVID 分母，2026-10-14）

日期：2026-10-14。范围：与 `stage-b-b5-3-detailed-plan-2026-10-14.md §2`
AR-1..AR-12 一一对应的机器可复算门槛；不授权实施前启动任何 Chrome / Runtime /
Provider / 音频。本文件仅冻结验收门槛与复算命令，由独立审查代理在每 BVID 落盘
后逐条复算。

## 1. 验收原则

- 验收只接受真实 fresh run，不接受单元测试、合规模型或旧产物拼接；
- 6 个 BVID 全部 `attempt_fresh`；`substitutionAllowed = false`；任一 BVID 受限于
  访问 / 隐私的样本必须留在分母并标 `blocked`，不得移除；
- 单任务锁单一 Provider；本子阶段默认 **MiniMax**（DeepSeek 不启用，详见 dev plan §11）；
- 跨 Provider 拼接 / 最佳 N / 隐式 fallback 视为 fail-closed；
- 0 原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径上传；上传计数仅授权范围内派生
  transcript / OCR / vision-caption 文本；
- 任一 BVID 失败 1 次 retry 后仍未通过即整 B-5 FAIL / REPLAN；
- `blocked` ≥ 2 触发 NO-GO / REPLAN（与 `stage-b-six-video-registry.json v1 maximumBlockedForStageExit=1` 一致）；
- 本轮 session 用户授权已一次性覆盖完整 6 BVID fresh run；执行序列由 dev plan §4
  步骤 5 串联执行，不要求也不允许在每个 BVID 前再次等待用户开关。

## 2. 自动验收分母（AR-1..AR-12）

### AR-1 6 BVID 全部 `attempt_fresh`

- 6 个 BVID 与 `stage-b-six-video-registry.json v1` 等价；
- 6 个 BVID 都不在分母外、未被替换、未被移除；
- `requiredDisposition = "attempt_fresh"` 在 6 个 BVID 上都达成。

复算命令：

```bash
sha256sum stage-b-six-video-registry.json
python3 - <<'PY'
import json
reg = json.load(open("stage-b-six-video-registry.json"))
assert reg["schemaVersion"] == "v3-5.10-stage-b-source-registry/v1"
assert len(reg["sources"]) == 6
assert reg["maximumBlockedForStageExit"] == 1
assert reg["substitutionAllowed"] is False
assert reg["crossRunArtifactReuseAllowed"] is False
assert set(reg["allowedFinalDispositions"]) == {"complete", "limited", "blocked", "failed"}
bvid_set = {s["bvid"] for s in reg["sources"]}
assert bvid_set == {"BV1pohR6rEEh", "BV1hMpE6FEXG", "BV1VHHe6kEH3",
                    "BV1SDHy6aEiB", "BV1vSHD6tEsM", "BV1FCps68EGf"}
print("REGISTRY OK")
PY
```

### AR-2 独立 task / Runtime / database / chrome-profile 命名空间

- 6 个 task ID 互不相同；
- 6 个 task ID 与既有 run 不重号；
- 每个 BVID 都有独立的 Runtime 进程号 / DB path / chrome-profile path /
  task namespace（写入 `<taskId>/isolation.json`）。

复算命令：

```bash
python3 - <<'PY'
import json, glob, hashlib
files = sorted(glob.glob("<evidence_root>/bvid-*/isolation.json"))
assert len(files) == 6, f"isolation.json files: {len(files)}"
pids, dbs, profiles = set(), set(), set()
for f in files:
    data = json.load(open(f))
    pids.add(data["runtimePid"])
    dbs.add(data["databasePath"])
    profiles.add(data["chromeProfileDir"])
    sha = hashlib.sha256(open(data["databasePath"], "rb").read()).hexdigest() if False else "n/a"
assert len(pids) == 6, "runtimePid collision"
assert len(dbs) == 6, "databasePath collision"
assert len(profiles) == 6, "chromeProfileDir collision"
print("ISOLATION OK")
PY
```

### AR-3 `--mute-audio` Chrome 实例

- 6 个 Chrome 实例启动行都含 `--mute-audio`；
- 无真实音频发声（本机无音频输出设备 / PulseAudio / PipeWire sink）；
- Xvfb 单独不视为静音。

复算命令：

```bash
grep -l -- '--mute-audio' <evidence_root>/bvid-*/chrome_launch.log | wc -l   # 期望 6
grep -c '^mute=1$' <evidence_root>/bvid-*/chrome_launch.log                 # 期望 ≥ 6
```

### AR-4 0 原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径上传

- 6 个 V2.1 receipt 中 6 upload counters 全 0；
- `receipts/secret_scan_*.csv` 中 `plaintext_present` 列全 0；
- receipts 中 `BAD` regex 0 命中；
- SQLite 中 6 PATTERN 全 0 命中。

复算命令（任一命中即 B-5-3 FAIL）：

```bash
# (a) SQLite 中无明文 API key
python3 - <<'PY'
import sqlite3, glob, re
PATTERNS = [r"sk-[A-Za-z0-9_\-]{16,}", r"sk_live_[A-Za-z0-9]{8,}",
            r"AIza[0-9A-Za-z_\-]{16,}", r"gho_[A-Za-z0-9]{16,}",
            r"deepseek-[A-Za-z0-9]{8,}", r"minimax-[A-Za-z0-9]{8,}"]
hits = []
for db in glob.glob("<evidence_root>/**/*.sqlite3", recursive=True) + glob.glob("<evidence_root>/**/*.db", recursive=True):
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

# (b) 接收层 0 命中
python3 - <<'PY'
import glob, re
BAD = re.compile(r"(cookie|secret|api[_-]?key|bearer|local[_-]?path|/etc/|/root/|dsKey\.txt|\.bilibili\.com/cookie|raw[-_]?video|raw[-_]?audio|raw[-_]?frame)", re.I)
files = glob.glob("<evidence_root>/receipts/**/*.json", recursive=True) + glob.glob("<evidence_root>/**/*receipt*.json", recursive=True)
hits = [(f, m.group(0)) for f in files for line in open(f, encoding="utf-8", errors="ignore") for m in BAD.finditer(line)]
print("HITS" if hits else "CLEAN")
PY

# (c) audit-subagent secret-scan
python3 audit_subagent.py secret-scan \
  --providers minimax \
  --runtime-root "<evidence_root>" \
  --report-out "<evidence_root>/secret_scan_$(date -u +%Y%m%dT%H%M%SZ).csv"

# (d) 抽样核验
test "$(awk -F, 'NR>1 {s+=$3} END {print s+0}' <evidence_root>/secret_scan_*.csv)" = "0"
```

### AR-5 V2.1 schema meta-validation 仍 PASS

- `verify-stage-b-route-2-contract-fixtures.py` 输出
  `schemaMeta: PASS` / `positiveInstances: 3/3 PASS` /
  `schemaNegatives: 5/5 PASS` / `registry: 11/11 present`。

复算命令：

```bash
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py
echo "EXITCODE=$?"
```

### AR-6 单任务仅一个权威 Provider

- 每个 task receipt 仅含 1 个 `providerId`；
- 不允许 0 或 ≥2；
- Chat 默认 MiniMax 不变；DeepSeek 不启用。

复算命令：

```bash
python3 - <<'PY'
import json, glob
files = sorted(glob.glob("<private>/grounded-comprehension-v2.1/*/revision-*/*.json"))
assert len(files) == 6, f"V2.1 derivatives: {len(files)}"
for f in files:
    data = json.load(open(f))
    rcpt = data.get("receipt", {})
    plist = rcpt.get("providerList") or data.get("providerList") or [rcpt.get("providerId")]
    assert plist is not None and len(plist) == 1, f"providerList != 1 in {f}: {plist}"
    assert plist[0] == "minimax_chat_completions", f"provider != minimax in {f}: {plist[0]}"
print("PROVIDER LOCK OK")
PY
```

### AR-7 composer 仅在两 allowlisted code 触发

- 6 个 BVID 中若任一触发 composer，则必属 `V3510B_BRIEF_LENGTH_INVALID` 或
  `V3510B_BRIEF_RAW_PREFIX`；其他失败仍走原始 provider 失败语义；
- 跨子阶段回归既有 3 条 `_BRIEF_COMPOSER_FAILURES` 断言（`test_ar1_*` /
  `test_ar2_*` / `test_ar3_*`）。

### AR-8 V2.1 atomic publish + 历史字节

- V2.1 derivative 写到 `<private>/grounded-comprehension-v2.1/<taskId>/revision-<r>/<catalogHash>.json`，
  mode `0o600`；
- commit 前 authority 屏障拒绝 revision / catalog 漂移；
- V2/V1 历史字节不被改写。

复算命令：

```bash
python3 - <<'PY'
import os, json, glob, hashlib
files = sorted(glob.glob("<private>/grounded-comprehension-v2.1/*/revision-*/*.json"))
assert len(files) == 6, f"V2.1 derivatives: {len(files)}"
for f in files:
    mode = os.stat(f).st_mode & 0o777
    assert mode == 0o600, f"mode != 0o600: {f} ({oct(mode)})"
    data = json.load(open(f))
    assert data.get("schemaVersion") == "v3-media-grounded-comprehension/v2.1"
print("V2.1 MODE OK")
PY
```

### AR-9 单元测试持续 PASS

- `test_v3_grounded_comprehension_b5_1.py`：12 passed；
- `test_v3_grounded_comprehension_b5_2.py`：9 passed；
- `test_v3_grounded_comprehension_v2.py`：10 passed；
- `test_v3_media_comprehension.py`：28 passed；
- `test_v3_companion_runtime.py`：6 passed；
- 合计 65/65 PASS。

复算命令：

```bash
cd services/local-runtime
python3 -m pytest \
  tests/test_v3_grounded_comprehension_b5_1.py \
  tests/test_v3_grounded_comprehension_b5_2.py \
  tests/test_v3_grounded_comprehension_v2.py \
  tests/test_v3_media_comprehension.py \
  tests/test_v3_companion_runtime.py
```

### AR-10 B-5-3 期间 product code 不动

- `quality.py` SHA 与 B-5-2 验收时一致：`414584d588db427cefabc86758e5e5656e749274ae4e5ef3514f06532add7fcc`；
- `service.py` SHA 与 B-5-2 验收时一致：`e87811cf335a194459c219e58d7ade467c79200cfc63946ea84bbb67cc7158a8`；
- `synthesis.py` SHA 与 B-5-2 验收时一致：`34d9093ed69d86dc4888cfdcb0a164a0b3cd2aa37547971cb505585e4fc1f168`；
- V2 schema SHA 与 M-B5-1-01 关闭时一致：`3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99`；
- V2.1 schema SHA：`33b363eef77ee859ceef684eb9404051a5491887a25da85923cca369f4ec8135`；
- fixtures SHA：`db0dcbcec056cd82f156ac54d895e441c682e0c2fe7dcdaf825478e4a1224705`；
- verifier SHA：`dec7d9ca2cc557437774efd93c688acdda6d7020c66051e00947796878dcb66e`；
- addendum SHA：`779dc3fd8ae326d87d8775e637d392adbd465841fedd5f826fcb5c5a9aa63153`。

复算命令：

```bash
cd <repo_root>
sha256sum \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-addendum.md
```

### AR-11 分母与 blocked 计数

- 6 个 BVID 中 `blocked` ≤ 1；
- 任一 BVID 失败 1 次 retry 后仍未通过即整 B-5 FAIL/REPLAN；
- 真实访问失败 / 隐私受限 → 标 `blocked`，保留在分母，不替换。

复算命令：

```bash
python3 - <<'PY'
import glob
files = sorted(glob.glob("<evidence_root>/bvid-*/final_disposition.txt"))
blocked = sum(1 for f in files if open(f).read().strip() == "blocked")
assert blocked <= 1, f"blocked > 1: {blocked}"
print(f"BLOCKED={blocked}/6 OK")
PY
```

### AR-12 失败 / 取消 / 重启清理

- 临时 media / cookie / token / profile / Chrome 进程 / Runtime 进程退出后全清零；
- 6 个 BVID 都产生 `<taskId>/cleanup.json`，含 5 步退出证据；
- 状态可解释。

复算命令：

```bash
python3 - <<'PY'
import json, glob, os
files = sorted(glob.glob("<evidence_root>/bvid-*/cleanup.json"))
assert len(files) == 6
for f in files:
    data = json.load(open(f))
    assert data.get("cleanupAtUtc"), f"missing cleanupAtUtc: {f}"
    steps = data.get("steps", [])
    assert len(steps) >= 5, f"cleanup steps < 5: {f}"
print("CLEANUP OK")
PY

# 临时目录残留扫描
find <runtime_root> -maxdepth 2 -type d -name "chrome-profile" -o -name "tmp" 2>/dev/null
# 期望：6 个 BVID 完成后为空
```

## 3. 失败码映射（仅允许 fail-closed）

| code | 接收门 | B-5-3 期望 |
|---|---|---|
| `V3510B_BRIEF_LENGTH_INVALID` | 进 composer 至多一次；无闭合子集保留原 code + 内部诊断 `V3510B_COMPOSER_NO_VALID_SUBSET` | 同 B-5-2 |
| `V3510B_BRIEF_RAW_PREFIX` | 同上 | 同上 |
| `V3510B_CLAIMS_*` / `V3510B_CHAPTERS_*` | fail-closed；不进 composer | 同 B-5-2 |
| `V3510B_AUTHORITY_*` | fail-closed；不进 composer | 同 B-5-2 |
| `V3510B_PROVIDER_UNQUALIFIED` | fail-closed；不得 fallback | 同 B-5-1 |
| `V3510B_PROVIDER_AUTHORIZATION` | fail-closed；不得 fallback | 同 B-5-1 |
| `V3510B_PROVIDER_REFUSAL` | fail-closed；不得 fallback（B-5-1 闭合） | 同 B-5-1 |
| `V3510B_PROVIDER_AUTHORIZATION_DENIED` | fail-closed；不得 fallback（B-5-1 闭合） | 同 B-5-1 |
| `V3510B_BVID_ACCESS_BLOCKED` | 当前 BVID 标 `blocked`，保留在分母 | 新增（B-5-3 专属） |

## 4. 复算命令（独立审查代理出门前逐条复算）

```bash
# (a) SHA-256 复算
cd <repo_root>
sha256sum \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py \
  services/local-runtime/navia_runtime/modules/media_companion/comprehension/synthesis.py \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-addendum.md

# (b) verifier
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py
echo "EXITCODE=$?"

# (c) 全回归
cd services/local-runtime
python3 -m pytest \
  tests/test_v3_grounded_comprehension_b5_1.py \
  tests/test_v3_grounded_comprehension_b5_2.py \
  tests/test_v3_grounded_comprehension_v2.py \
  tests/test_v3_media_comprehension.py \
  tests/test_v3_companion_runtime.py

# (d) MR-06 (a) SQLite 明文 key 扫描
# (e) MR-06 (b) receipts 0 命中扫描
# (f) MR-06 (c) audit-subagent secret-scan
# (g) MR-06 (d) secret_scan_*.csv plaintext_present 列求和 = 0

# (h) V2.1 derivative 落盘形态 + 6 upload counters 全 0 + mode 0o600

# (i) isolation.json 6 个不同 Runtime / DB / profile

# (j) chrome_launch.log `--mute-audio` 出现 6 次

# (k) cleanup.json 6 个，每个 ≥5 步
```

任一项不达即 B-5-3 FAIL/REPLAN；不允许"只跑完部分分母"。

## 5. 不允许的验收姿势

- 单元测试 / 合规模型 / 旧 run 拼接顶替真实 fresh run；
- 拼凑 V6 验证结果到 B-5-3；
- 调低 brief 长度 / claim 数 / 章节覆盖率门槛；
- 使用 mock Provider 或 fake transcript；
- 凭旧产物或将 sentinel 评分顶替新评分；
- 跨 Provider 拼接 / 最佳 N / 隐式 fallback；
- 在 Chat 默认仍是 MiniMax 时自动使用 DeepSeek；
- 在用户未单独授权时启动 Chrome / Runtime / Provider / 派生文本上传；
- 不在 `<taskId>/isolation.json` 写入 fresh isolation 指纹；
- 漏写 `<taskId>/cleanup.json` 清理证据；
- 拼凑已有 receipt 顶替新 receipt。

## 6. 出本验收外的依赖与门禁

- 用户已一次性下达 high-risk 授权覆盖完整 6 BVID fresh run（已在本轮 session 生效）；
- 用户已下达 high-risk 授权允许选择 DeepSeek 任务级派生文本上传（已在本轮
  session 生效，但 B-5-3 默认 MiniMax，详见 dev plan §11）；
- 用户未授权时，所有证据均按文档 SHA-256 收纳，不含 Chrome 实际启动；
- B-5-4 / B-5-5 / B-5-6 / B-5-7 仍需独立 Claude Code CLI 复算后单独出门。

## 7. B-5-3 出门后衔接

- B-5-3 出门 → B-5-4（清理与汇总独立审查）→ B-5-5（closure 包）→ B-5-6
  （handoff 到 B-6 宿主语义）→ B-5-7（canonical audit package ≤ 20 文件）；
- 不进入 B-6 / B-7 / Stage C / D / E / V3-6 / V3-7；
- 不 commit / push；
- 不替独立审查作最终结论。

# Stage B B-5 恢复验收计划（V3-5.10）

日期：2026-10-14。范围：B-5 真实 fresh 六视频分母。本验收计划只冻结门槛，不与 Dev 计划冲突；不授权实际启动 Chrome、Runtime、Provider、音频或真实上传。

## 1. 验收原则

- 验收只接受真实 fresh run，不接受单元测试、合规模型或旧产物拼接。
- 6 个 BVID 全部 `attempt_fresh`；`substitutionAllowed=false`；任一受限于访问/隐私的样本必须留在分母并标 `blocked`，不得移除。
- 单任务锁单一 Provider；任何跨 Provider 拼接、最佳 N 选一、隐式 fallback 视为 fail-closed。
- Provider 范围：MiniMax 默认；DeepSeek 仅在 Settings 手动选择后启用；任务级 Provider 在 receipt 中明文。
- 0 原始视频/音频/帧/Cookie/密钥上传；上传计数仅授权范围内派生 transcript / OCR / vision-caption 文本。

## 2. 自动验收分母（MR-01..MR-12）

每个自动验收分母必须单次 fresh run；并仅接受一次证据 ID。

| MR-ID | 描述 | 门槛 |
|---|---|---|
| MR-01 | 6 个 BVID 注册表存在性与字节相符 | `stage-b-six-video-registry.json` v1 哈希匹配；6 个 BVID 等价 |
| MR-02 | 每个 BVID 任务分配独立 task ID | 6 个 task ID 互相不同；与既有 run 不重号 |
| MR-03 | fresh Runtime/database/chrome-profile/task | 每个 BVID 都有独立的 Runtime 进程号、数据库路径、profile 路径与 task 命名空间 |
| MR-04 | `--mute-audio` Chrome 实例 | 6 个 Chrome 实例启动行都含 `--mute-audio`；无真实音频发声 |
| MR-05 | 上传 0 原始视频/音频/帧 | 上传计数 0；BVID 任务级 receipt 不含 raw media 上传字段 |
| MR-06 | 上传 0 Cookie/密钥/本地路径 | secret scan 0；SQLite 中无明文 API key；OS Credential Vault 完整；可复算命令见下文 §3.1 |
| MR-07 | V2.1 schema meta-validation | `v3_media_grounded_comprehension_v2_1.schema.json` 通过 Draft 2020-12 meta；2 个正例与 N01/N07 负例与新增 N02/N05/N08 通过 |
| MR-08 | 单任务仅一个权威 Provider | 每个 task receipt 仅含 1 个 providerId；不允许 0 或 ≥2 |
| MR-09 | Provider 选择与 Chat 默认一致 | MiniMax 默认；DeepSeek `selected=false`；首次使用未自动切换 |
| MR-10 | composer 仅生效于两个 allowlisted code | 只有 `V3510B_BRIEF_LENGTH_INVALID` / `V3510B_BRIEF_RAW_PREFIX` 触发；其他失败仍返回 provider 原始失败 |
| MR-11 | V2.1 原子发布与历史字节 | V2.1 写入后 V2/V1 字节不变；revision/catalog 漂移拒绝提交 |
| MR-12 | 失败清理 | 临时媒体、cookie、profile、Chrome 进程、Runtime 进程退出后全清零；状态可解释 |

任一项不过：当前 BVID 标记 `failed`；B-5 阶段 FAIL/REPLAN；其他 BVID 不补位、不移除分母。

## 3. 失败码映射（仅允许 fail-closed）

| code | 触发 | 接收门 |
|---|---|---|
| `V3510B_BRIEF_LENGTH_INVALID` | brief 归一化后 ≠ [20, 100] | 仅可触发 composer；不调低阈值 |
| `V3510B_BRIEF_RAW_PREFIX` | brief 是 transcript 原文前缀 | 仅可触发 composer |
| `V3510B_CLAIMS` / `V3510B_CHAPTERS` | claims/cardinality/coverage 非有限覆盖 | fail-closed；不得 compose |
| `V3510B_AUTHORITY` | task/revision/catalog 不匹配 | fail-closed；不得 compose |
| `V3510B_PROVIDER_UNQUALIFIED` | Provider 未授权或未能力测试 | fail-closed；不得 fallback |
| `V3510B_PROVIDER_AUTHORIZATION` | 用户未在 Settings 选择 | fail-closed；不得 fallback |
| `V3510B_COMPOSER_NO_VALID_SUBSET` | composer 未找到合格 subset | 内部诊断；HTTP 层返回原始 provider 失败 |

### 3.1 MR-06 可复算命令（必须 0 命中）

下列命令在每个 BVID 任务级 receipt 落盘后必须由独立审查代理在 `<runtime_root>` 工作目录中**逐条**执行；任一命中即 B-5 FAIL/REPLAN；命令与参数固定、不得替换为等价变体。

```bash
# (a) SQLite 中无明文 API key：扫描所有 *.sqlite3 与 *.db 内的可逆 secret 列与已知 key 前缀
python3 - <<'PY'
import sqlite3, glob, re
PATTERNS = [r"sk-[A-Za-z0-9_\-]{16,}", r"sk_live_[A-Za-z0-9]{8,}",
            r"AIza[0-9A-Za-z_\-]{16,}", r"gho_[A-Za-z0-9]{16,}",
            r"deepseek-[A-Za-z0-9]{8,}", r"minimax-[A-Za-z0-9]{8,}"]
hits = []
for db in glob.glob("**/*.sqlite3", recursive=True) + glob.glob("**/*.db", recursive=True):
    try:
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    except Exception:
        continue
    try:
        for (name,) in con.execute("SELECT name FROM sqlite_master WHERE type='table'"):
            for sql in (f'SELECT * FROM "{name}"',):
                try:
                    rows = con.execute(sql).fetchall()
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

# (b) 上传 receipt 0 命中：扫 receipts/ 目录，禁止出现 cookie/secret/local-path/raw media 标记
python3 - <<'PY'
import glob, re, sys
BAD = re.compile(r"(cookie|secret|api[_-]?key|bearer|local[_-]?path|/etc/|/root/|dsKey\.txt|\.bilibili\.com/cookie|raw[-_]?video|raw[-_]?audio|raw[-_]?frame)", re.I)
files = glob.glob("receipts/**/*.json", recursive=True) + glob.glob("**/*receipt*.json", recursive=True)
hits = [(f, m.group(0)) for f in files for line in open(f, encoding="utf-8", errors="ignore") for m in BAD.finditer(line)]
print("HITS" if hits else "CLEAN")
PY

# (c) OS Credential Vault 完整：调用 audit-subagent 独立子代理（与 B-5 实现责任人不同）
#     输出 CSV 三列：provider, vault_ref_present, plaintext_present
#     期望：vault_ref_present=1 且 plaintext_present=0
python3 audit_subagent.py secret-scan \
  --providers minimax,deepseek \
  --runtime-root "$PWD" \
  --report-out receipts/secret_scan_$(date -u +%Y%m%dT%H%M%SZ).csv

# (d) 抽样核验：receipts/secret_scan_*.csv 中 plaintext_present 列必须全部 0
test "$(awk -F, 'NR>1 {s+=$3} END {print s+0}' receipts/secret_scan_*.csv)" = "0"
```

固定门槛：`HITS / non-zero CSV sum` 任一非零即 MR-06 不通过；不接受 mock/合规模型/旧产物顶替真实 fresh run。

## 4. 宿主语义审查（不在本计划内，但 B-5 必须为其产生可复算证据）

- 6 个 BVID 独立宿主模型 ID + prompt SHA-256 + session ID 在 receipt 中记录；
- 每维度（accuracy / whole-span coverage / fit / chapter boundary）≥ 4；零 critical 错误。
- 1 个 sentinel BVID 重复同主题同主要论点；任何反转 Major。

## 5. 独立实施出门审计（不在本计划内，但 B-5 必须为其产生可复算证据）

- 新独立 Claude Code CLI / Orca reviewer，task ID / dispatch hash 与上文 B-6/实现 session 不同；
- Fatal=0 / Major=0；
- 不允许用单元测试/合规模型/旧产物顶替真实 fresh run。

## 6. 不允许的验收姿势

- 单元测试/合规模型/旧 run 拼接；
- 拼凑 V6 验证结果到 B-5；
- 调低 brief 长度、claim 数量、章节覆盖率门槛；
- 使用 mock Provider 或 fake transcript；
- 拼凑已有 sentinel 评分顶替新评分；
- 在用户未明确授权时启动 Chrome/Runtime/Provider。

## 7. 出本计划外的依赖与门禁

- 用户单独下达 high-risk 授权方可启动 B-5 真实 fresh run；
- 用户单独下达 high-risk 授权方可选择 DeepSeek 用于 B-5 任务级派生文本上传；
- 用户未授权时，所有证据均按文档 SHA-256 收纳，不含 Chrome 实际启动。
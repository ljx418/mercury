# Stage B B-5-3 STOP 报告（真实 fresh 6 BVID 分母，2026-10-14）

日期：2026-10-14。本报告记录 B-5-3 真实 fresh 6 BVID 分母执行前的环境探查结论、
预执行 STOP 触发条件与保留的可复算证据；本会话在 B-5-3 启动前 STOP，不再进入
BVID 0/6 实施。

## 1. STOP 原因（与 dev plan §9 / acceptance §5 / preimplementation §10 一致）

**STOP 触发条件：无法证明 fresh isolation / 无法驱动真实 fresh run**（dev plan §9 第 9 条 +
acceptance §5"无法证明 fresh isolation"）。

## 2. 环境探查结论

### 2.1 基础设施层（已落盘实测）

| 项 | 状态 | 证据 |
|---|---|---|
| WSL2 Ubuntu 24.04 | ✓ | `uname -a` → Linux 6.18.40.1-microsoft-standard-WSL2 |
| Python 3.12.3 | ✓ | `python3 --version` |
| sqlite3 CLI | ✓ | `/usr/bin/sqlite3` |
| Xvfb / xvfb-run | ✓ | `/usr/bin/Xvfb` + `/usr/bin/xvfb-run` |
| Chromium 149.0.7827.55（playwright） | ✓ | `/home/administrator/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome` |
| `--mute-audio` 启动行可加 | ✓ | Chromium 接受 `--mute-audio` 启动行；本机无音频输出设备；Xvfb 不发声 |
| Bilibili 网络可达 | ✓ | `curl -sI --max-time 5 https://www.bilibili.com` → `HTTP/2 200` |
| navia_runtime.app 可加载 | ✓ | `python3 -c "from navia_runtime.app import app"` 无异常 |
| Companion service 可启动 | ✓ | `python3 -m navia_runtime.companion` → `Uvicorn running on http://127.0.0.1:17861`；`GET /v1/health` 返回 200 |
| Vision Provider (MiniMax) 已配置且 `test_status=ok` | ✓ | `SELECT id, adapter_kind, test_status_json FROM vision_providers;` → `minimax-cn-openai-vision \| minimax_chat_completions \| {"status":"ok",...}` |
| api_key 明文落库 | ✗ | `SELECT id, length(api_key), secret_storage FROM llm_providers;` → `length(api_key)=0` 且 `secret_storage="windows_credential_vault"` |
| Chrome extension 已构建 | ✓ | `apps/chrome-extension/chrome-mv3-unpacked/manifest.json` + `background.js` + `content-scripts/bilibili-page-state-main.js` |

### 2.2 关键缺口（无法证明 fresh isolation 的具体点）

| 缺口 | 影响 | 证据 |
|---|---|---|
| **Chrome extension 未在 Windows Chrome 中加载** | bilibili.com/video/* 页面无法被 content script 注入；transcript/OCR/vision-caption 三类证据无法被捕获；evidence catalog 永远为空 | `~/.navia/companion.json` 在本会话被重写为新生成的随机 ext_id；旧 pairing 不再有效；当前 session 无 Windows Chrome 用户操作 |
| **`MediaComprehensionService.synthesize_v2` 路径硬要求 ready 状态 + evidence catalog 非空** | 缺 1 即抛 `V351_TASK_NOT_READY` / `V351_EVIDENCE_REQUIRED`（service.py line 84 / 87） | 见 `service.py::MediaComprehensionService.synthesize` line 200-205 |
| **Bilibili transcript 抓取依赖 Chrome extension `tabCapture` + SESSDATA cookie** | 公开视频不登录可看，但 transcript 是 ASR 输出，需要扩展抓取 player 音频或 video tag；当前 WSL 端无 SESSDATA，无 tabCapture | manifest permissions: `tabCapture` + `optional_permissions: ["cookies"]` + `optional_host_permissions: ["https://*.bilibili.com/*"]` |
| **Per-BVID fresh isolation 需独立 SQLite + 独立 companion 实例 + 独立 chrome-profile + 独立 task_id** | 这部分基础设施**理论上可行**（写一个 per-BVID 启动脚本），但因 §2.2 头部 3 条无法满足 evidence catalog 真实生成，整体仍 fail | 见 dev plan §4 步骤 1 |
| **现有 `.navia/media-tasks/` 11 个 media_task 均为旧 session 产物** | 不可作为"fresh run"使用（fresh isolation 硬性要求 task_id 不重号） | `SELECT task_id, source_identity, state FROM media_tasks;` |

### 2.3 既有 session 失败证据佐证

- `stage-b-real-runs/20261014T054026046Z-stage-a-failure.json`：BV1pohR6rEEh fresh 失败，
  `runtimeTail` 显示 uvicorn 起在 58890，`POST /v1/media/tasks/<id>/comprehension/synthesize`
  返回 502 `Claim count is invalid.`，Provider result 被 reject。
- 该失败证明：上游某处（外部 harness 或用户 Chrome 操作）确实驱动过真实 fresh run；
  本会话无对应驱动源。

## 3. 拒绝清单复核（与 preimplementation audit §11 一致）

| 拒绝项 | 当前是否触发 | 说明 |
|---|---|---|
| 单元测试 / 合规模型 / 旧 run 拼接顶替真实 fresh run | 否 | 本会话连单元测试都没跑（§4.1 复算命令仍可跑作为基线记录） |
| 调低 brief 长度 / claims 数 / 章节覆盖率门槛 | 否 | product code 未动 |
| 跨 Provider 拼接 / 最佳 N / 隐式 fallback | 否 | product code 未动 |
| 在 Chat 默认 MiniMax 时自动使用 DeepSeek | 否 | Chat 默认 MiniMax，DeepSeek 不启用 |
| 在用户未授权时上传真实项目派生文本 | 否 | 本会话无任何 Provider 调用 |
| 凭旧产物或将 sentinel 评分顶替新评分 | 否 | 无评分 |
| 任意原始视频 / 音频 / 帧 / Cookie / API key / 本地路径上传 | 否 | 无任何网络/Provider 调用 |
| 任意 Chrome 缺 `--mute-audio` | 否 | 无 Chrome 实例启动 |

## 4. 可复算证据（本会话已落盘且可重跑）

### 4.1 product code / 合同指纹复算（baseline，未跑 fresh run）

```bash
cd /mnt/c/workSpace/navia
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

期望输出与 `independent-b5-1-b5-2-implementation-audit-2026-10-14.md §3` 完全一致
（本会话未修改 product code / 合同）。

### 4.2 verifier 复算（baseline）

```bash
python3 docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py
echo "EXITCODE=$?"
```

期望：`schemaMeta: PASS / positiveInstances: 3/3 PASS / schemaNegatives: 5/5 PASS /
registry: 11/11 present / implementationPending: 8 条`（与 B-5-2 验收一致）。

### 4.3 全回归 pytest（baseline，未跑 fresh run）

```bash
cd services/local-runtime
python3 -m pytest \
  tests/test_v3_grounded_comprehension_b5_1.py \
  tests/test_v3_grounded_comprehension_b5_2.py \
  tests/test_v3_grounded_comprehension_v2.py \
  tests/test_v3_media_comprehension.py \
  tests/test_v3_companion_runtime.py
```

期望：65 passed（与 B-5-2 验收一致）。

### 4.4 MR-06 (a) baseline（现有 `.navia/navia.sqlite3`）

```bash
python3 - <<'PY'
import sqlite3, re
PATTERNS = [r"sk-[A-Za-z0-9_\-]{16,}", r"sk_live_[A-Za-z0-9]{8,}",
            r"AIza[0-9A-Za-z_\-]{16,}", r"gho_[A-Za-z0-9]{16,}",
            r"deepseek-[A-Za-z0-9]{8,}", r"minimax-[A-Za-z0-9]{8,}"]
hits = []
for db in ["/mnt/c/workSpace/navia/.navia/navia.sqlite3"]:
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
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
print("HITS" if hits else "CLEAN")
PY
```

本会话实测：`HITS`（在 `pages` 表，与历史 agent session 抓取的 URL/title 文本相关，
非 API key；`api_key` 列 `length=0`，`secret_storage=windows_credential_vault`）。
B-5-3 fresh per-BVID 隔离 DB 不复用此库，故本会话未触发 per-BVID MR-06 violation。

## 5. STOP 后的处置

### 5.1 本会话不再执行

- B-5-3 真实 fresh 6 BVID run（每 BVID 独立 Runtime / DB / chrome-profile / task
  命名空间实例化）；
- B-5-4 清理证据汇总；
- B-5-5 closure 包；
- B-5-6 handoff 到 B-6；
- B-5-7 external-audit-package ≤20 文件；
- B-6 / B-7 / Stage C / D / E / V3-6 / V3-7 任何后续。

理由：B-5-3 没跑通，后续子阶段依赖 B-5-3 产物；不进入下一子阶段符合 STOP 边界。

### 5.2 不删除 / 回滚任何已落盘文件

- `stage-b-b5-3-detailed-plan-2026-10-14.md`（B-5-3 详细开发计划）；
- `stage-b-b5-3-acceptance-2026-10-14.md`（B-5-3 验收标准）；
- `stage-b-b5-3-preimplementation-audit-2026-10-14.md`（B-5-3 实施前审计）；
- 本 STOP 报告；
- `~/.navia/companion.json`（本次重启生成，已写 0o600）。

### 5.3 状态词

- B-5-3：PRE-EXECUTION STOP — `无法证明 fresh isolation`；
- B-5 整体：仍为 FAIL/REPLAN（与 dev plan §3 一致）；
- B-6 / B-7 / Stage C / D / E / V3-6 / V3-7：仍 NO-GO；
- 不 commit / push；不替独立审查作最终结论。

## 6. 重启 B-5-3 所需条件

由独立审查代理或后续 session 验证以下条件后，B-5-3 才可重启：

1. 用户在 Windows Chrome 上加载 `apps/chrome-extension/chrome-mv3-unpacked/`
   并完成一次性 pairing（产生新 `companion.json`，含有效 ext_id）；
2. 用户在 Chrome 上手动导航至 6 BVID URL（顺序：BV1pohR6rEEh →
   BV1hMpE6FEXG → BV1VHHe6kEH3 → BV1SDHy6aEiB → BV1vSHD6tEsM → BV1FCps68EGf）；
3. 每次 Chrome 实例启动行包含 `--mute-audio`；
4. 每次 BVID 由独立 session 触发（每 BVID 一个 task_id；不要 reuse 旧 task_id）；
5. BVID 完成后核对 isolation.json / receipt.json / cleanup.json / secret_scan.csv
   / chrome_launch.log / provider_lock.txt / final_disposition.txt 七份证据；
6. 任一 BVID blocked → 留分母；≥2 blocked → STOP；
7. 任一 forbidden 数据上传 / 音频泄露 / 合同漂移 → STOP。

## 7. 决定复述

B-5-3 **PRE-EXECUTION STOP**。原因：无法证明 fresh isolation（Windows Chrome
+ Navia extension 未加载；bilibili transcript 无法在 WSL 端独立捕获）。基础设施层
全部就位（compilation / service / vision provider / chrome binary / network），
但驱动源缺位。B-5-3 不进入 BVID 0/6 实施；B-5-4..B-5-7 不在本会话执行。重启条件见 §6。

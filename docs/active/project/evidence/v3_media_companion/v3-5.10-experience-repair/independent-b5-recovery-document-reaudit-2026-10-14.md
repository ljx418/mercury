# V3-5.10 B-5 恢复文档独立审查第二轮独立只读复审（2026-10-14）

日期：2026-10-14。审查人：与主干隔离的独立审查代理（同工作树、`docs/active/project/external-audit-package/` 之外）。
任务来源：`docs/active/project/external-audit-package/01-audit-request.md` 与 `AUDIT_MANIFEST.md`（2026-10-14 修订版）。
基线报告：`docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/independent-b5-recovery-document-audit-2026-10-14.md`（首轮，3 Major + 3 Minor）。
范围：仅文档 / 只读复审首轮 3 Major + 3 Minor 是否真实关闭；不实施 B-5，不运行产品代码、Runtime、Chrome、Provider；无任何网络 / 数据上传；不修改任何源文件、合同、fixtures、注册表、源凭证；不 commit / push；唯一新增文件即本报告。
约束边界：依据 `docs/active/project/AGENTS.md`、`docs/active/project/design/project-stage-workflow.md`、`AUDIT_MANIFEST.md` 与 `01-audit-request.md`。

## 1. 总体决定

- **DOCUMENT 状态：PASS**（首轮 3 Major + 3 Minor 全部真实关闭）。
- **B-5 实施决定：FAIL / REPLAN + 仍 NO-GO pending user high-risk authorization**。
- **B-6 宿主语义审查、B-7 独立实施出门审计、Stage C/D/E、V3-6/V3-7：仍 NO-GO**。
- **MiniMax 默认、DeepSeek `selected=false` 与 DeepSeek 任务级启用 / 真实项目派生文本上传未授权三条边界**：全部维持，未被任何本包文档扩张。
- 用户当前已落盘授权范围（与首轮一致）：仅"Chat Provider 密钥迁移到 OS Credential Vault + 从桌面 `dsKey.txt` 安全导入 DeepSeek + B-5 文档冻结"；**未授权**启动 B-5 真实 fresh、DeepSeek 任务级启用 / 真实项目派生文本上传、B-6/B-7 实施、Stage C-E / V3-6/V3-7 实施。

## 2. 复查边界（明确不扩展）

- 不运行 Chrome / `--mute-audio` / Xvfb / 任何音频发声。
- 不调用 Provider（M3 / deepseek-chat / 任何候选）。
- 不下载、不上传真实视频/音频/帧/Cookie/密钥/本地路径；不读 `dsKey.txt`。
- 不修改 product code、fixtures、schema、源 PRD / 架构 / 开发计划 / 验收计划 / Stage Gate / V3-5.10 parent plan 的 §18.1 / §1 / §2309 / §8.20.12a / §27 / 末尾块笔记。
- 不实施 B-5；不动 `quality.py` / `service.py` / `synthesis.py` / `media_cache.py` / `portal_settings.py`。
- 不删除 / 回滚主工作树既有改动（AGENTS.md 改写、`apps/chrome-extension/chrome-mv3-unpacked/chunks/` 删除 86 项、未跟踪产品文件 49 项均属于用户 / 前置会话进度；本审查唯一可写文件即本报告）。
- 不 commit / push。

## 3. 复查项目边界 — 首轮 3 Major 逐项关闭证据

### 3.1 Major #1 — manifest 顶层不可复算聚合 SHA

首轮证据（`independent-b5-recovery-document-audit-2026-10-14.md` §3.3）：manifest §1 顶层声明 `cf63f9e4…36adf692`；三种拼接策略（hex 级联 / binary digest 级联 / hex+\n）均不匹配。

第二轮独立复算：

- manifest 全文 grep "聚合 / 顶层 / aggregate / top-level"：仅命中 §0 第 7 行 "修订说明" 自陈"已删除 … 不再声明任何基于拼接 / 级联的不可复算字段"；§1 标题明确"19 份载荷逐文件 SHA-256（**唯一核验形态**）"。
- manifest §1 表 19 行：每行均为单文件 SHA；无任何"顶层""聚合""汇总"字段。
- 复算脚本（hex 级联 / binary digest 级联）输出 `1978503a…3a8c` / `47adea2c…200d` —— 但 manifest §1 **不引用任何聚合值**；这两值只作为诊断锚点存在，不参与通过 / 不通过判定。
- manifest §8 通过判据："§1 19 份载荷 SHA-256 与本地 `sha256sum` 复算 0 mismatch"；无聚合要求。

**Major #1 关闭**。证据：manifest 仅有 19 行独立 SHA-256 表与"已删除"自陈；不再用任何聚合字段充当通过开关。

### 3.2 Major #2 — manifest 自引用 SHA 字段逻辑错误

首轮证据（§3.4）：manifest §5 自陈"在最后一次写入结束时复算"自身 SHA `db0bcb3e…90e1c`，但任何后续字节变动（包括写回该 SHA）都会让声明失效。

第二轮独立复算：

- manifest 全文 grep "本 manifest 的字节 / 自身的 / 最后一次写入"：仅命中 §0 第 8 行 "已删除" 自陈；§6 显式说明"本 manifest 不再声明自身的'最后一次写入结束时复算' SHA（自引用逻辑错误，已删除）"。
- manifest §6 仅含"如需核验 manifest 当前字节 SHA，由读者独立运行 `sha256sum AUDIT_MANIFEST.md`"——这是**读者自查指引**，不是 manifest 自声明的、通过/不通过开关。
- on-disk 当前 `AUDIT_MANIFEST.md` 字节 SHA-256：`efb40865ce0aab4ad5e0b77b9250c497338f5050566d4e4610492108a8eaa54a`（仅留痕，不参与 §8 通过判据）。
- manifest §8 通过判据中无 manifest 自身字节 SHA 项。

**Major #2 关闭**。证据：自引用字段已物理删除；当前 §6 文字是声明"不再声明"，并把"读者自查"作为可选留痕。

### 3.3 Major #3 — 08 / 09 / 10 三份 B-5 文档与权威源字节不一致

首轮证据（§3.5）：包 08 / 09 / 10 标题级 `Stage B ` 前缀被删、中文标点 / 全宽空格被规范化，与源字节不等；manifest §4 笼统"一致"断言对该三件不成立。

第二轮独立复算：

- `diff -q` 源 vs 包：08 / 09 / 10 / 15 **逐项 0 difference**（OK）。
- `sha256sum` 源 vs 包（8 份有权威源副本的载荷）：

  | 包内 | 权威源 | 源 SHA-256 | 包 SHA-256 | 一致 |
  |---|---|---|---|:-:|
  | 11 | `contracts/v3_media_grounded_comprehension_v2.schema.json` | `3d6519df…42f7fc99` | `3d6519df…42f7fc99` | ✓ |
  | 12 | `contracts/v3_media_grounded_comprehension_v2_1.schema.json` | `39b2061f…19ec231` | `39b2061f…19ec231` | ✓ |
  | 13 | `evidence/.../stage-b-six-video-registry.json` | `25331486…ca8f439` | `25331486…ca8f439` | ✓ |
  | 14 | `evidence/.../stage-b-route-2-contract-fixtures.json` | `3d24bb4a…d604982` | `3d24bb4a…d604982` | ✓ |
  | 15 | `evidence/.../verify-stage-b-route-2-contract-fixtures.py` | `c4b70708…92928` | `c4b70708…92928` | ✓ |
  | 08 | `evidence/.../stage-b-b5-recovery-development-plan.md` | `2efa91af…efdb471` | `2efa91af…efdb471` | ✓ |
  | 09 | `evidence/.../stage-b-b5-recovery-acceptance-plan.md` | `4fb1d3c5…70bc2b` | `4fb1d3c5…70bc2b` | ✓ |
  | 10 | `evidence/.../stage-b-b5-recovery-preimplementation-audit.md` | `932d5e1d…71074` | `932d5e1d…71074` | ✓ |

- manifest §4 已重写为"分项陈述"——逐行列出 8 项源 / 包对照；§5 显式记录 08 / 09 / 10 / 15 四份权威源的具体改动（DEV-1 出门条件追加质量 / 服务两文件 SHA 落盘；MR-06 追加 4 条 bash 可复算命令；§1 实施前指纹基线；verifier fallback 列表追加 `12-v2.1.schema.json`）；其余源未改。
- §0 "修订说明" line 9 自陈 08 / 09 / 10 由"权威源 → 包"同步路径在 2026-10-14 修订完成，源 vs 包 SHA-256 全部 0 mismatch。

**Major #3 关闭**。证据：8 / 8 源 / 包字节等价；manifest §4 / §5 改为分项陈述并披露改动；改动边界（DEV-1 出门条件、MR-06 复算命令、§1 指纹基线、verifier fallback）均落在原状态纠偏与冻结开发计划的边界内，不改 §18.1 / §1 / §2309 / §8.20.12a / §27 / 末尾块笔记。

## 4. 复查项目边界 — 首轮 3 Minor 逐项关闭证据

### 4.1 Minor #1 — `15-route-2-fixture-verifier.py` 在包目录直接运行 `StopIteration`

首轮证据（§5.3）：脚本按"原证据目录"约定查找 `HERE/10-v2.1.schema.json`（包内为 `12-…`），fallback 也不命中。

第二轮独立复算（在本包目录直接运行）：

```bash
$ cd docs/active/project/external-audit-package
$ python3 15-route-2-fixture-verifier.py; echo EXITCODE=$?
```

输出（exitcode 0）：

```text
{
  "implementationAuthorized": false,
  "implementationPending": [
    "V3510B21-N02", "V3510B21-N03", "V3510B21-N04",
    "V3510B21-N05", "V3510B21-N06", "V3510B21-N08",
    "V3510B21-N09", "V3510B21-N10"
  ],
  "positiveInstances": "2/2 PASS",
  "registry": "10/10 present",
  "schemaMeta": "PASS",
  "schemaNegatives": "2/2 PASS"
}
EXITCODE=0
```

对照 manifest §8 通过判据期望输出：schemaMeta PASS / positiveInstances 2/2 PASS / schemaNegatives 2/2 PASS / registry 10/10 present / implementationAuthorized false —— 字段名 / 数值 / 退出码全部一致。

**Minor #1 关闭**。证据：脚本从包目录直接运行 exitcode 0，输出与 manifest §8 期望完全一致。

### 4.2 Minor #2 — 09 MR-06 缺可复算命令

首轮证据（§7 Minor #2）：09:25 提到"Sqlite 中无明文 API key；OS Credential Vault 完整"，但未给出独立可复算命令。

第二轮独立复算：

- 09 §3.1 包含 4 条**固定** bash 块（命令与参数不得替换为等价变体；§3.1 第 48 行）：

  - **(a) SQLite 明文 API key 扫描**：`python3 - <<'PY' ...` glob `**/*.sqlite3` / `**/*.db`，按 `PATTERNS`（`sk-…` / `sk_live_…` / `AIza…` / `gho_…` / `deepseek-…` / `minimax-…`）正则扫所有行；输出 `HITS` 或 `CLEAN`。
  - **(b) 接收层 0 命中**：扫描 `receipts/**/*.json` 与 `**/*receipt*.json`，正则匹配 `cookie / secret / api[_-]?key / bearer / local[_-]?path / /etc/ / /root/ / dsKey.txt / .bilibili.com/cookie / raw[-_]?video / raw[-_]?audio / raw[-_]?frame`；输出 `HITS` 或 `CLEAN`。
  - **(c) audit-subagent secret-scan**：调用 `audit_subagent.py secret-scan --providers minimax,deepseek --runtime-root "$PWD" --report-out receipts/secret_scan_$(date -u +%Y%m%dT%H%M%SZ).csv`；期望 `vault_ref_present=1 / plaintext_present=0`。
  - **(d) 抽样核验**：`test "$(awk -F, 'NR>1 {s+=$3} END {print s+0}' receipts/secret_scan_*.csv)" = "0"`。

- §3.1 第 101 行："`HITS / non-zero CSV sum` 任一非零即 MR-06 不通过；不接受 mock / 合规模型 / 旧产物顶替真实 fresh run"——门槛明文。

- manifest §5 第 110 行自陈：09 §2 MR-06 已追加"可复算命令清单（4 条 bash 块，覆盖 SQLite 明文扫描、receipt 0 命中、audit-subagent secret scan、CSV 抽样核验）"——与本审查所见一致。

**Minor #2 关闭**。证据：09 §3.1 现有 4 条固定 bash 块覆盖 SQLite 明文 / 接收层 / 凭据库 / 抽样四类，门槛明文不可被替换。

### 4.3 Minor #3 — quality.py / service.py 指纹缺失

首轮证据（§7 Minor #3）：08:65-69 描述 `service.py` 与 `quality.py` 实现边界，但包内未附两文件的当前字节或契约指纹。

第二轮独立复算：

- 10 §1 "实施前指纹基线（未跟踪产品代码当前 SHA-256）" 第 11-12 行：

  | 文件 | 当前字节 SHA-256 | 大小 | mtime (UTC) |
  |---|---|---:|---|
  | `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py` | `ca73029c4b2fa226273d59777f4a63d689d85651963c5470905b04e709488997` | 18202 | 2026-10-14T13:20:00Z |
  | `services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py` | `579c1d86a1202c239e5a601ef043f479adc6145cc5e3a3da6e63771a84f3b14a` | 34343 | 2026-10-14T13:20:00Z |

- 复算（仓库根目录）：

  ```text
  ca73029c4b2fa226273d59777f4a63d689d85651963c5470905b04e709488997  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py
  579c1d86a1202c239e5a601ef043f479adc6145cc5e3a3da6e63771a84f3b14a  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py
  ```

- 大小：`18202` / `34343` bytes——一致。
- mtime：`2026-10-14 13:20`（与 `T13:20:00Z` 一致）。

- 08 §5 DEV-1 第 53 行已把上述两指纹写为出门条件："`quality.py` 当前 `ca73029c4b2fa226273d59777f4a63d689d85651963c5470905b04e709488997`、`service.py` 当前 `579c1d86a1202c239e5a601ef043f479adc6145cc5e3a3da6e63771a84f3b14a`；DEV-3 实施前两文件任一字节变动必须重算并在 `stage-b-b5-recovery-preimplementation-audit.md §1` 中追加变更说明。"
- 10 §1 第 22-26 行已列"与 stage-a 既有实现差异列表（截至 2026-10-14）"：quality.py 当前仅承载 stage-b 起草期间的 selection / dedup 草案与 `format = "；"` 规范化；service.py 当前仅承载 stage-b Route 2 起草期间的 composer 入口与 `0600` atomic replace 草案；两文件均未与现有 V1 / V2 grounded-comprehension 路径联通，不得在 B-5 实施前被任何生产路径引用。

- manifest §5 第 111 行自陈：10 §1 已新增"实施前指纹基线"小节——与本审查所见一致。

**Minor #3 关闭**。证据：10 §1 + 08 §5 DEV-1 双处落盘两文件指纹；本审查独立复算与当前字节完全一致。

## 5. 文档内容侧 — 19 载荷 SHA / 权威状态词对账

### 5.1 19 载荷 SHA-256 + manifest §1 逐行核验

```text
8ac4ad45a804aab71630499ea4785692f394ec8f872e91f1414aa0fd445651cc  01-audit-request.md
99d17bbee4acd4300aeac432c861bfb05b1d6aa6c0157640c1fec5a7bb636dc1  02-prd-status-drift-correction.md
9467aaf8f7b088c47c949c2a604f45f44bdcabd1b402753771fa6439d5b1cfa1  03-architecture-status-drift-correction.md
5416fcba76a00349389502fb0050dfa3e5baabe0c25a34178edb8605c5816d0e  04-development-plan-status-drift-correction.md
c62bfb7e6794fe33b14b7343d3b2a8b00f039ef29616425a9223059314942a8b  05-acceptance-plan-status-drift-correction.md
dc0c1a64f943c7826681a60cbac9716f35d5dee1f7e836595fbb2c7d12d6d882  06-stage-gate-status-drift-correction.md
c575a61213bcaeda98cb0850a9ecb728d71c0d8ce61ffe34e1cf46ca318b5a34  07-v3-5.10-parent-plan-correction.md
2efa91af9eec202c63ea549c9f047e8894cb2b7def6675f8cd3fde7abefdb471  08-b5-recovery-development-plan.md
4fb1d3c5fdebb71e0350a75e2d559811191f48c01f382717286c70b32a70bc2b  09-b5-recovery-acceptance-plan.md
932d5e1def22e6c9d2b37442f92f587ab50c412756b821ffe62c4a9f85f71074  10-b5-recovery-preimplementation-audit.md
3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99  11-v2.schema.json
39b2061f5ee3dc564b98f1a3c6b81088261ae7d23050cddc337c9c01519ec231  12-v2.1.schema.json
25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439  13-six-video-registry.json
3d24bb4aed25eea1862cfb8590d6efa13510771b6a72791e10bcfa1a3d604982  14-route-2-contract-fixtures.json
c4b70708ad0d530568b3e9012d7cc891bdb0ba2babfd08c8d1ec58d085295928  15-route-2-fixture-verifier.py
27da35bff982a3f980352074b276493d45104a77863cce62f4288a3d12f338cc  16-b5-risk-stop.md
f26501f839426eee9888ed33eef8c39bd8c24c6bf9696763d73a48047bdcc8fc  17-route-2-replan.md
7d3925d2a830e95f680959b5b311de538ec2b09d57956e1ae0c8575533687a30  18-deepseek-strict-exit.md
6d00d7c82775877770669dc25f7a240b956dde880a34a5c363faebd8f2d5232e  19-chat-provider-secret-migration.md
```

manifest §1 第 13-33 行声明的 19 行 SHA-256 与本表逐行 0 mismatch ✓。
manifest 自身字节 SHA-256（仅留痕）：`efb40865ce0aab4ad5e0b77b9250c497338f5050566d4e4610492108a8eaa54a`（§6 读者自查指引）。

08 / 09 / 10 / 15 哈希相对首轮变化与 manifest §5 / §0 "修订说明" line 9 / 12 完全一致（08: `7e644768…ea002` → `2efa91af…db471`；09: `3bfb93b7…98441` → `4fb1d3c5…0bc2b`；10: `6b27b591…dd80d` → `932d5e1d…71074`；15: `62de319b…f77a0` → `c4b70708…92928`）。

### 5.2 权威状态词对账（02-07 vs PRD / 架构 / 开发 / 验收 / Stage Gate / parent plan）

逐项抽查状态词：

| 文件 | 抽查处 | 与源块对应 | 状态词一致 |
|---|---|---|:-:|
| `01-prd.md:2275` 状态纠偏 | PRD 18.1 | `02-prd-status-drift-correction.md:11` | ✓ |
| `02-architecture.md:5` 状态纠偏 | 架构第 1 节 | `03-architecture-status-drift-correction.md:7-8` | ✓ |
| `03-development-plan.md:2311` 状态纠偏 | 开发 §2309 | `04-development-plan-status-drift-correction.md:10-12` | ✓ |
| `04-acceptance-plan.md:2186` 状态冻结 | 验收 §8.20.12a | `05-acceptance-plan-status-drift-correction.md:6-13` | ✓ |
| `stage-gates/v3-media-companion.md:281` 状态冻结 | Stage Gate §27 | `06-stage-gate-status-drift-correction.md:7-15` | ✓ |
| `design/v3-5.10-media-experience-repair-plan.md:75` 状态冻结 | parent plan 末尾块 | `07-v3-5.10-parent-plan-correction.md:7-15` | ✓ |

逐处比对 6 块内文字：Stage A `LIMITED PASS`（单 BVID `BV1hMpE6FEXG`、Orca `task_b307e1598b9e`、Fatal=0/Major=0/Minor=3）；Stage B B-0 冻结 PASS；B-1..B-4 `LIMITED PASS candidate`；Route 2 文档 CONDITIONAL GO + 实现 LIMITED PASS（外部独立审查 SHA `b3db4ffc82283712c28737a0ee569403e1194ea280b74ab24408f2c66eb72079`）但 **B-5 真实六视频分母仍 FAIL / REPLAN**；DeepSeek strict adapter DS-1..DS-5 `LIMITED PASS`（20/20 结构，不证明内容）；Chat 默认 MiniMax、DeepSeek `selected=false`、保存 ≠ 选择、首次使用不诱导、不自动切换；B-5..B-7 / Stage C/D/E / V3-6/V3-7 全部 NO-GO —— 02-07 与 6 处源块语义、关键 BVID / task ID / SHA / 失败码 / 边界声明全部 0 mismatch。

不删除既有 §18.1 / §1 / §2309 / §8.20.12a / §27 / 末尾块笔记；既有 V3-5.1 / V3-5.2a / V3-5.2 / H01-RDS / PX-6 历史事实保持不变。

## 6. Chat Provider 边界（M3 默认 / DeepSeek 未授权）

逐项检查 6 份纠偏笔记 + 08 / 09 / 10 / 16 / 17 / 18 / 19 中所有 Provider 表述：

- **MiniMax 默认**：`02:12` "MiniMax 保持默认" / `03:7` "Chat Provider 默认仍为 MiniMax" / `04:10` "Chat Provider 默认仍是 MiniMax" / `05:11` "Chat Provider 默认：MiniMax" / `06:11` "Chat Provider 默认：MiniMax" / `07:11` "Chat Provider 默认 MiniMax" / `08:9, 60, 99` "Provider 选择与 Chat Provider 选择同时默认 MiniMax" / `10:53` "Chat 默认 MiniMax 不受影响" / `18:24, 48` "媒体 factory 默认仍使用已验证 MiniMax" / `19:3, 31` "MiniMax 保持默认且 DeepSeek 不自动切换" —— 全包无矛盾。
- **DeepSeek 状态**：`02:12` "未选中" / `03:7` "未启用" / `04:10` "未启用" / `05:11` "未选中；保存不等于选择" / `06:11` "`selected=false`。保存 ≠ 选择" / `07:11` "未启用；保存 ≠ 选择" / `08:9, 59` "`selected=false`；保存 ≠ 选择" / `10:53` "`selected=false`" / `18:24, 43` "B-5 必须等待用户在 Settings 中手动完成 DeepSeek 配置…并显式切换 … 系统继续以 MiniMax 为默认，不允许自动 fallback 到 DeepSeek" / `19:3, 21, 30, 31` "`DeepSeek selected: false` … 本记录不授权自动切换 DeepSeek，也不上传真实视频派生内容" —— 一致保持 DeepSeek 未启用边界。
- **任务级启用与真实项目派生文本上传未授权**：`08:3, 15` "恢复实施仍需用户单独下达高风险授权" / `08:76` "下载仅限既有授权范围内的派生文本" / `09:11, 25` MR-05 / MR-06 门槛；MR-06 §3.1 4 条 bash 块覆盖原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径 0 命中 / `dsKey.txt` 0 命中 / `vault_ref_present=1 / plaintext_present=0` / CSV 抽样 sum = 0 / `10:73` "DeepSeek 任务级启用与真实项目派生文本上传必须用户单独高风险授权才能进入 B-5 fresh" / `18:43-48` "B-5 必须等待用户在 Settings 中手动完成 DeepSeek 配置、选择 `deepseek-chat`、执行严格能力测试并显式切换 … 若用户不切换，系统继续以 MiniMax 为默认，不允许自动 fallback 到 DeepSeek … 该授权仍不包含自动切换或真实项目派生文本上传" / `19:30, 31` "本记录不授权自动切换 DeepSeek，也不上传真实视频派生内容" —— 一致保持"任务级 DeepSeek + 真实项目派生文本上传必须由用户单独高风险授权"。
- **不允许的边界扩张**：跨 Provider 拼接、最佳 N 选一、隐式 fallback、阈值降低、SecretStore 兼容列回填、原始视频 / 音频 / 帧上传、Cookie 复活、脚本退出和临时文件路径清理 —— `08:15` / `16:25, 62` / `18:43` / `19:30` 全部维持 fail-closed。

未撤销既有"DeepSeek 仅凭据库导入、`selected=false`、不自动切换、不真实项目派生上传"任何一条边界。

## 7. 用户授权状态盘点（落盘证据 — 与首轮一致，未扩张）

| 已落盘授权记录 | 范围 | 是否覆盖下列高风险动作 |
|---|---|---|
| `01-audit-request.md`、`17-route-2-replan.md:97-103` | Stage B 设计与文档冻结 | 不替代 B-5 真实 fresh 与 B-6 / B-7 出门审查 |
| `19-chat-provider-secret-migration.md:3, 30-31` | 用户明确批准迁移 Chat Provider 密钥到 OS Credential Vault + 从桌面 `dsKey.txt` 导入 DeepSeek | 仅迁移 + 导入；不包含自动切换、不包含真实项目派生文本上传 |
| `18-deepseek-strict-exit.md:43, 45-48` | DeepSeek 任务级启用条件收紧为 Settings 内手动 + 显式切换 | 当前 Settings UI 未触发；只授权过的密钥迁移 ≠ 任务级使用 |
| `16-b5-risk-stop.md` 与 `08-b5-recovery-development-plan.md:3, 79, 106`、`09-b5-recovery-acceptance-plan.md:69-71` | B-5 真实 fresh 与真实项目派生文本上传必须由用户单独高风险授权才可启动 | 当前无此授权 |

结论：

- **未授权**事项（与首轮一致；本包文档未做扩张解读）：
  - 启动 B-5 真实 fresh（含 Chrome、Runtime、Provider、音频、`--mute-audio` 实例、不混批）。
  - 单任务选择 DeepSeek 为 Chat Provider 之外的 B-5 Provider（含把真实项目派生 transcript / OCR / vision-caption 文本送到 DeepSeek `deepseek-chat + beta strict tool`）。
  - B-6 宿主语义审查与 B-7 独立实施出门审计。
  - Stage C / D / E 实施。
  - V3-6 / V3-7 实施。
- **已授权**事项：仅"密钥迁移到 OS Credential Vault + 从 `dsKey.txt` 安全导入 DeepSeek + B-5 文档冻结（不含任何实施动作）"。

任何以此审查通过为由扩张为"V3 PASS / Stage B PASS / B-5 PASS / Chat-Know PASS"均为不实扩解。

## 8. Findings-first 分类（第二轮）

### FATAL — 0

- 19 载荷 SHA-256 与 manifest §1 表逐行 0 mismatch；
- 8 / 8 源 / 包字节等价（含 08 / 09 / 10 三件修复后）；
- 02-07 与权威源块（§18.1 / §1 / §2309 / §8.20.12a / §27 / parent plan 末尾块）语义一致；
- `python3 15-route-2-fixture-verifier.py` 包目录直接运行 exitcode 0，输出与 manifest §8 期望一致；
- MR-06 4 条 bash 块覆盖 SQLite / 接收 / 凭据库 / CSV 四类，门槛明文；
- quality.py / service.py 指纹在 10 §1 + 08 §5 DEV-1 双处落盘，独立复算一致；
- MiniMax 默认 / DeepSeek `selected=false` / 任务级启用与真实项目派生文本上传未授权三条边界全包维持；
- 不引入 / 不创造任何 provider 自动切换、跨 Provider 拼接、最佳 N 选一、阈值降低、隐式 fallback、原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径上传。

### MAJOR — 0

首轮 3 项 Major 全部真实关闭（§3.1 / §3.2 / §3.3 逐项给出证据）；本轮未发现新 Major。

### MINOR — 0

首轮 3 项 Minor 全部真实关闭（§4.1 / §4.2 / §4.3 逐项给出证据）；本轮未发现新 Minor。

### 额外观察 — 非阻断

- `08-B-5 dev plan:39` BVID 6 行表格与 §4 不变量（`substitutionAllowed=false / crossRunArtifactReuseAllowed=false`）在源文件 13 与包 13 完全一致 ✓。
- `16-b5-risk-stop.md:14-16, 21-25` 与 `08-B-5 dev plan:7` 与本审查一致认定"继续到剩余五视频不会关闭第一段固定分母；旧 run / 拼凑 MiniMax 结果会触发拼凑假绿风险" ✓。
- `17-route-2-replan.md:97-103` 的授权边界显式将"已批准 Stage B 实施"与"用户须显式批准 Route 2 实施"做拆分；本审查认可此拆分 ✓。
- `04-acceptance-plan-status-drift-correction.md:13` 与 `06-stage-gate-status-drift-correction.md:14-15` 显式"用户对 DeepSeek 任务级选择与真实项目派生文本上传必须另行高风险授权"——与 §6 一致 ✓。
- `08-B-5 dev plan:9` 明确引用 `chat-provider-secure-secret-migration-and-deepseek-import-2026-10-14.md`，确认授权范围未在本轮扩张 ✓。
- 15 `verify-stage-b-route-2-contract-fixtures.py` 改动边界仅在 SCHEMA fallback 列表追加 `HERE / "12-v2.1.schema.json"`；未触及 fixtures、注册表、断言、退出码 ✓。
- 09 / 10 改动边界（DEV-1 出门条件追加质量 / 服务两文件 SHA、MR-06 追加 4 条 bash 命令、§1 实施前指纹基线 + 与 stage-a 差异列表）落在"状态纠偏后第一份冻结开发计划"范围内；未授权任何 Chrome / Runtime / Provider / 上传动作；未修改 §18.1 / §1 / §2309 / §8.20.12a / §27 / 末尾块笔记或既有凭据迁移条款 ✓。
- 主工作树未跟踪文件：49 个；其中 `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py`、`synthesis.py`、`media_cache.py`、`portal_settings.py` 与测试 `test_v3_grounded_comprehension_v2.py`、`test_v3_media_portal_settings.py`、`tests/conftest.py` 已被前置会话写出；本审查不修改、不评估这些产品代码。
- `apps/chrome-extension/chrome-mv3-unpacked/chunks/` 86 项 `D ` 状态均为 `wxt` 构建产物删除，属于用户前置会话进度；本审查未触及、不得回退。
- AGENTS.md 追加 `--mute-audio` 行 + `project-stage-workflow` 引用行与本审查结论一致（不冲突、不构成回退面）。

## 9. 仍需用户明确授权（不属本审查包范围）

下列高风险授权未在落盘证据中存在；本审查拒绝将其归并到任何既有授权：

1. **B-5 真实 fresh 六视频分母的高风险实施授权**：在 6 个固定 BVID 上各跑一次 `attempt_fresh`，含 `Runtime/database/chrome-profile/task` 全 fresh 隔离 + `--mute-audio` + 单任务锁单 Provider + 真实 Chat Provider + 派生 transcript / OCR / vision-caption 文本上传。授权必须显式包含"接受音频 0 命中、原始视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径 0 命中、≥ 2 个 blocked 触发 NO-GO"三条底线。
2. **DeepSeek 用于 B-5 任务级的 Provider 高风险授权**：在 Settings 中明确选择 `deepseek-chat + beta strict tool`、并在任务级 receipt 中以 DeepSeek 为唯一 Provider，且上传真实项目派生文本到 DeepSeek。当前 `19-chat-provider-secret-migration.md` 显式排除此项。
3. **B-6 宿主语义审查的实施授权**：含独立宿主模型 ID、prompt SHA-256、session ID，每维度评分 ≥ 4，1 sentinel 重复验证。
4. **B-7 独立实施出门审计的实施授权**：与 B-6 责任人 + B-5 实现责任人均不同。
5. **Route 2（确定性 brief composer）实施授权**：在 B-5 之外仍要求单独授权（`17-route-2-replan.md:97-103`），不得据本审查包放大。
6. **Stage C / D / E、V3-6 / V3-7 的实施授权**：均 NO-GO。

## 10. 命令与未运行边界（只读、可复算）

下列命令在本审查中已运行（仅 stdlib 与 `sha256sum`），结果与本报告一致：

```bash
# 19 载荷字节 SHA-256 逐项
cd docs/active/project/external-audit-package
sha256sum *.md *.json *.py | sort -k 2

# 8 源 vs 包字节对照（含 08 / 09 / 10 / 15）
diff -q 08-b5-recovery-development-plan.md \
        ../evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-development-plan.md
diff -q 09-b5-recovery-acceptance-plan.md \
        ../evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-acceptance-plan.md
diff -q 10-b5-recovery-preimplementation-audit.md \
        ../evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-preimplementation-audit.md
diff -q 15-route-2-fixture-verifier.py \
        ../evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py
sha256sum \
  ../contracts/v3_media_grounded_comprehension_v2.schema.json \
  ../contracts/v3_media_grounded_comprehension_v2_1.schema.json \
  ../evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-six-video-registry.json \
  ../evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json \
  ../evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py \
  ../evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-development-plan.md \
  ../evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-acceptance-plan.md \
  ../evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-preimplementation-audit.md

# verifier 从包目录直接运行
python3 15-route-2-fixture-verifier.py; echo "EXITCODE=$?"

# quality.py / service.py 当前字节指纹
sha256sum services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py \
          services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py

# 源块定位（02-07 vs PRD / 架构 / 开发 / 验收 / Stage Gate / parent plan）
grep -n "V3-5.10 子阶段状态纠偏" docs/active/project/01-prd.md
grep -n "V3-5.10 子阶段状态纠偏" docs/active/project/02-architecture.md
grep -n "V3-5.10 实施计划状态纠偏" docs/active/project/03-development-plan.md
grep -n "V3-5.10 Stage A/B 验收状态冻结" docs/active/project/04-acceptance-plan.md
grep -n "V3-5.10 子阶段状态冻结" docs/active/project/stage-gates/v3-media-companion.md
grep -n "2026-10-14 状态冻结" docs/active/project/design/v3-5.10-media-experience-repair-plan.md

# 验证聚合 / 自引用字段已物理删除
grep -n -E "聚合|顶层|aggregate|self[-_ ]?(ref|sha)" docs/active/project/external-audit-package/AUDIT_MANIFEST.md
grep -n -E "本 manifest 的字节|自身的|最后一次写入" docs/active/project/external-audit-package/AUDIT_MANIFEST.md
```

未运行（按 §2 边界）：

- 任何 Chrome / `--mute-audio` / Xvfb 实例 / 音频发声。
- 任何 Provider（M3 / deepseek-chat / 任何候选）真实调用。
- 任何真实 Runtime / `pytest` / `npm test` / `WXT` 构建。
- 任何真实视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径上传；任何 `dsKey.txt` 读入。
- 任何 B-5 / B-6 / B-7 / Stage C / D / E / V3-6 / V3-7 的实施动作。
- 任何文件删除 / git commit / git push。

## 11. 首轮 3 Major + 3 Minor 关闭证据汇总表

| 首轮 ID | 类别 | 简述 | 关闭证据 | 状态 |
|---|---|---|---|:-:|
| Major #1 | manifest 顶层不可复算聚合 SHA | manifest §1 顶层聚合字段不可独立复算 | manifest §1 仅 19 行独立 SHA；§0 自陈"已删除"；§8 通过判据无聚合要求；grep "聚合/顶层"仅命中 §0 修订说明 | ✓ 关闭 |
| Major #2 | manifest 自引用 SHA | §5 声明"最后一次写入结束时复算"自身 SHA，构造上自指 | §6 显式"已删除"；grep "本 manifest 的字节/自身的/最后一次写入"仅命中 §0 / §6 修订说明 + 读者自查指引；§8 通过判据无自 SHA 项 | ✓ 关闭 |
| Major #3 | 08 / 09 / 10 源 / 包字节不等 | manifest §4 笼统"一致"对三件不成立 | 源 vs 包 `diff -q` 0 difference；`sha256sum` 8/8 一致；manifest §4 改写为分项陈述；§5 显式记录 08/09/10/15 改动边界 | ✓ 关闭 |
| Minor #1 | verifier 在包目录 StopIteration | 脚本 fallback 找不到 `12-v2.1.schema.json` | 15 在 SCHEMA fallback 列表追加 `HERE / "12-v2.1.schema.json"`；包目录直接运行 exitcode 0；输出与 manifest §8 期望字段名 / 数值完全一致 | ✓ 关闭 |
| Minor #2 | MR-06 无可复算命令 | 09:25 仅描述门槛，未给独立命令 | 09 §3.1 含 4 条固定 bash 块（SQLite / 接收 / audit-subagent / CSV 抽样）；门槛明文"不接受 mock / 合规模型 / 旧产物顶替" | ✓ 关闭 |
| Minor #3 | quality.py / service.py 指纹缺失 | 包内未附两文件指纹 | 10 §1 + 08 §5 DEV-1 双处落盘两指纹；独立复算与当前文件字节完全一致；10 §1 已列"与 stage-a 既有实现差异列表" | ✓ 关闭 |

## 12. 决定复述（与 §1 对齐）

- DOCUMENT：PASS（首轮 3 Major + 3 Minor 全部真实关闭；本轮未发现新 Fatal / Major / Minor）。
- B-5：FAIL / REPLAN + 仍 NO-GO pending user high-risk authorization（按本审查 §6 / §9 与 `stage-b-b5-route-2-risk-stop-2026-10-14.md` 一致）。
- B-6、B-7、Stage C/D/E、V3-6/V3-7：NO-GO。
- Chat Provider 默认：MiniMax。
- DeepSeek：已通过 Windows Credential Vault 安全导入；**任务级启用与真实项目派生文本上传未授权**。
- 用户已落盘授权的范围：仅"密钥迁移到凭据库 + `dsKey.txt` 安全导入 + B-5 文档冻结（不含任何实施动作）"；其余 B-5 / B-6 / B-7 / DeepSeek 任务级 / 真实上传 / Stage C-E / V3-6/V3-7 均未授权。
- B-5 实施前置条件：**用户须单独下达明确高风险授权**（覆盖 §9.1 三条底线 + DeepSeek 任务级与上传的单独授权）；本审查不替主干做修订、亦不替用户做决策；本审查通过不代表"B-5 可实施"。

本审查结束。审查人不实施 B-5，不 commit / push，仅落盘本报告。

---

## 附录 A：本报告新增的 SHA-256 留痕

```text
ca73029c4b2fa226273d59777f4a63d689d85651963c5470905b04e709488997  services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py
579c1d86a1202c239e5a601ef043f479adc6145cc5e3a3da6e63771a84f3b14a  services/local-runtime/navia_runtime/modules/media_companion/comprehension/service.py
efb40865ce0aab4ad5e0b77b9250c497338f5050566d4e4610492108a8eaa54a  docs/active/project/external-audit-package/AUDIT_MANIFEST.md（仅留痕，不参与通过/不通过判定）
```

其余 19 载荷 SHA 见 §5.1；8 源 SHA 见 §3.3 / §5.1。

## 附录 B：诊断锚点（仅留痕，不参与通过/不通过判定）

```text
# 19 载荷 hex 字符串按 01..19 顺序级联后 SHA-256
1978503a45d6e483136d10f2f973e76222e46c6a7daccd80b0e1c47dce833a8c
# 19 载荷 binary digest 按 01..19 顺序级联后 SHA-256
47adea2c7db4afd1a8cd16f9f6b86b5f19dac0ae275979358191f0b2947a200d
```

manifest 不引用以上任一值；仅供后续若需重建聚合字段时复算。

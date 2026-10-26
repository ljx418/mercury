# V3-5.10 状态纠偏 + B-5 恢复文档风险闭环报告（2026-10-14）

日期：2026-10-14。范围：响应独立审查代理 `independent-b5-recovery-document-audit-2026-10-14.md` 中 3 项 Major + 3 项 Minor 全部修订与关闭。canonical 包位于 `docs/active/project/external-audit-package/`。本报告为内部自检与 handoff 记录；独立审查报告本身不放入包内。

## 1. 范围与边界

- 仅修改：4 份权威源（`stage-b-b5-recovery-{development,acceptance,preimplementation-audit}-plan.md` + `verify-stage-b-route-2-contract-fixtures.py`）+ 1 份 manifest（重写）+ 19 份包副本（清空重建）+ 1 份新自检文件（本文件）。
- 不修改：18.1 / 1 / 2309 / 8.20.12a / 27 / 末尾块笔记、合同 schema、fixtures、注册表、源凭证、产品代码（`quality.py` / `service.py` / `synthesis.py` / `portal_settings.py`）、测试。
- 不运行：Chrome、`--mute-audio`、Xvfb、Provider、Runtime、`pytest`、上传、`dsKey.txt` 读入。
- 不 commit / push。

## 2. 修订明细

### Major #1 — 顶层聚合 SHA-256 算法不明确

- **关闭动作**：删除 `AUDIT_MANIFEST.md §1` 顶层 `cf63f9e4d6935d04c8e48039f93d1e22cccaf776b52905b41890e50836adf692` 字段及"按上表顺序拼接 19 个 SHA-256 字符串再 SHA-256"声明；新 manifest §1 仅保留 19 份载荷逐文件 SHA-256 表 + 唯一复算命令（`sha256sum` 19 行）。
- **关闭证据**：独立审查的 §3.3 三种拼接策略均不匹配的事实已由删除字段根除；通过判据改为"19 行 `sha256sum` 与本表逐行 0 mismatch"。

### Major #2 — manifest 自引用 SHA 字段构造错误

- **关闭动作**：删除 `AUDIT_MANIFEST.md §5` 全部"本 manifest 自 SHA"声明（包括 `db0bcb3e…90e1c` 字段与"在最后一次写入结束时复算"自述）。新 manifest §6 明确：不再声明 manifest 自身 SHA，亦不参与任何通过/不通过判定；如需核验 manifest 字节，由读者独立运行 `sha256sum AUDIT_MANIFEST.md`。
- **关闭证据**：自引用逻辑错误由字段删除根除；当前 manifest 自身字节 SHA `efb40865ce0aab4ad5e0b77b9250c497338f5050566d4e4610492108a8eaa54a`（仅作 handoff 留痕，不参与判定）。

### Major #3 — 08/09/10 源 vs 包字节不一致

- **关闭动作**：
  1. 修改权威源（先于包重建）：
     - `stage-b-b5-recovery-development-plan.md` §5 DEV-1：追加质量/服务两文件当前 SHA-256 落盘与差异列表出门条件。
     - `stage-b-b5-recovery-acceptance-plan.md` §2 MR-06：追加可复算命令清单（4 条 bash 块：SQLite 明文扫描、receipt 0 命中、audit-subagent secret scan、CSV 抽样核验）。
     - `stage-b-b5-recovery-preimplementation-audit.md` §1：新增"实施前指纹基线"小节，列 `quality.py`（`ca73029c…88997`）与 `service.py`（`579c1d86…3b14a`）当前 SHA-256、大小、mtime 与复算命令。
  2. 清空 `docs/active/project/external-audit-package/`，从权威源逐字节复制 08/09/10/11/12/13/14/15，并保留 01-07/16-19（这 11 份为包自带，无独立权威源副本）。
  3. 新 manifest §4 改为分项陈述：8 份有源副本的载荷（11/12/13/14/15 与修订后 08/09/10）逐项列出源 vs 包 SHA-256，全部 ✓。
- **关闭证据**：8/8 源 vs 包字节一致，0 mismatch（见 §3 复算）。

### Minor #1 — verifier 跨包运行 StopIteration

- **关闭动作**：在 `verify-stage-b-route-2-contract-fixtures.py` 的 `SCHEMA = next(path for path in (...))` 列表中追加 `HERE / "12-v2.1.schema.json"` 作为第三条 fallback，保持 `ROOT/contracts/...` 与 `HERE/10-v2.1.schema.json` 原有两条不变。
- **关闭证据**：`cd docs/active/project/external-audit-package && python3 15-route-2-fixture-verifier.py` → `exit 0`，输出 `{"schemaMeta": "PASS", "positiveInstances": "2/2 PASS", "schemaNegatives": "2/2 PASS", "registry": "10/10 present", "implementationPending": ["V3510B21-N02","V3510B21-N03","V3510B21-N04","V3510B21-N05","V3510B21-N06","V3510B21-N08","V3510B21-N09","V3510B21-N10"], "implementationAuthorized": false}`。

### Minor #2 — MR-06 缺可复算命令

- **关闭动作**：在权威源 `stage-b-b5-recovery-acceptance-plan.md` §3.1（新增小节）固化 4 条 bash 块：（a）`sqlite3` 明文 API key 扫描（用 `python3 -` heredoc + 6 个高熵模式 + `**/*.sqlite3` + `**/*.db`）；（b）receipts 0 命中（cookie/secret/api[_-]?key/bearer/local[_-]?path/dsKey.txt/raw-* 等禁词）；（c）`audit_subagent.py secret-scan` 三列 CSV 输出；（d）`awk` 抽样核验 `plaintext_present` 列求和为 0。门槛：`HITS` / non-zero CSV sum 任一非零即 MR-06 不通过。
- **关闭证据**：4 条命令与参数固定、不得替换为等价变体；本报告 §4 复算演示。

### Minor #3 — 08/10 缺 quality.py / service.py SHA-256

- **关闭动作**：
  - 权威源 `stage-b-b5-recovery-preimplementation-audit.md` §1（新增小节）固化 `quality.py`（`ca73029c4b2fa226273d59777f4a63d689d85651963c5470905b04e709488997`）与 `service.py`（`579c1d86a1202c239e5a601ef043f479adc6145cc5e3a3da6e63771a84f3b14a`）的当前字节 SHA-256、大小、mtime 与复算命令；并附"与 stage-a 既有实现差异列表"。
  - 权威源 `stage-b-b5-recovery-development-plan.md` §5 DEV-1 出门条件追加"质量/服务两文件当前 SHA-256 落盘"与"DEV-3 实施前两文件任一字节变动必须重算并在 §1 追加变更说明"。
- **关闭证据**：两文件 SHA-256 已可独立复算；DEV-3 实施前的字节变动触发条件已写入文档。

## 3. 包重建复算（19 + 8 + 20 三层 0 mismatch）

### 3.1 19 份载荷 SHA-256 vs manifest 表

```text
8ac4ad45…45651cc  01-audit-request.md                       ✓
99d17bbe…36dc1    02-prd-status-drift-correction.md         ✓
9467aaf8…1cfa1    03-architecture-status-drift-correction.md ✓
5416fcba…16d0e    04-development-plan-status-drift-correction.md ✓
c62bfb7e…942a8b   05-acceptance-plan-status-drift-correction.md ✓
dc0c1a64…6d882    06-stage-gate-status-drift-correction.md   ✓
c575a612…8b5a34   07-v3-5.10-parent-plan-correction.md        ✓
2efa91af…efdb471  08-b5-recovery-development-plan.md          ✓
4fb1d3c5…70bc2b   09-b5-recovery-acceptance-plan.md           ✓
932d5e1d…f71074   10-b5-recovery-preimplementation-audit.md   ✓
3d6519df…42f7fc99 11-v2.schema.json                            ✓
39b2061f…519ec231 12-v2.1.schema.json                          ✓
25331486…ca8f439  13-six-video-registry.json                   ✓
3d24bb4a…3d604982 14-route-2-contract-fixtures.json            ✓
c4b70708…085295928 15-route-2-fixture-verifier.py              ✓
27da35bf…12f338cc 16-b5-risk-stop.md                           ✓
f26501f8…7bdcc8fc 17-route-2-replan.md                         ✓
7d3925d2…33687a30 18-deepseek-strict-exit.md                   ✓
6d00d7c8…f2d5232e 19-chat-provider-secret-migration.md         ✓
```

19 / 19 一致，0 mismatch。

### 3.2 8 份有源副本的载荷 源 vs 包 SHA-256

```text
3d6519df…42f7fc99  11-v2.schema.json                            ✓
39b2061f…519ec231  12-v2.1.schema.json                          ✓
25331486…ca8f439   13-six-video-registry.json                   ✓
3d24bb4a…3d604982  14-route-2-contract-fixtures.json            ✓
c4b70708…085295928 15-route-2-fixture-verifier.py                ✓
2efa91af…efdb471   08-b5-recovery-development-plan.md          ✓
4fb1d3c5…70bc2b    09-b5-recovery-acceptance-plan.md           ✓
932d5e1d…f71074    10-b5-recovery-preimplementation-audit.md   ✓
```

8 / 8 一致，0 mismatch。

### 3.3 包目录结构

- 平铺：1 个目录（`.`），无子目录。
- 文件数：20（19 载荷 + 1 manifest）。
- 命名：`01..19-…` 编号 + `AUDIT_MANIFEST.md`。
- 独立审查报告 `independent-b5-recovery-document-audit-2026-10-14.md` 不在包内（位于 `evidence/v3_media_companion/v3-5.10-experience-repair/`，不属于审计包负载）。

### 3.4 verifier 实际运行（从包目录直接）

```bash
$ cd docs/active/project/external-audit-package
$ python3 15-route-2-fixture-verifier.py
{"implementationAuthorized": false, "implementationPending": ["V3510B21-N02", "V3510B21-N03", "V3510B21-N04", "V3510B21-N05", "V3510B21-N06", "V3510B21-N08", "V3510B21-N09", "V3510B21-N10"], "positiveInstances": "2/2 PASS", "registry": "10/10 present", "schemaMeta": "PASS", "schemaNegatives": "2/2 PASS"}
$ echo $?
0
```

`schemaMeta=PASS`、`positiveInstances=2/2 PASS`、`schemaNegatives=2/2 PASS`、`registry=10/10 present`、`implementationAuthorized=false`，exit 0。

## 4. 现状与状态词（与本轮审查包一致，未改写历史）

- DOCUMENT：CANDIDATE CONDITIONAL GO（独立审查 3 Major + 3 Minor 已在本轮修订中全部关闭；本自检报告为修订后落盘）。
- B-5：FAIL/REPLAN（未授权状态不变；`stage-b-b5-route-2-risk-stop-2026-10-14.md` 与 §6 盘点未改）。
- B-6、B-7、Stage C/D/E、V3-6/V3-7：NO-GO。
- Chat Provider 默认：MiniMax。
- DeepSeek：已通过 Windows Credential Vault 安全导入、`selected=false`；任务级启用与真实项目派生文本上传仍未授权。
- 用户已落盘授权范围：仅"密钥迁移到凭据库 + `dsKey.txt` 安全导入 + 文档冻结"；其余 B-5 / B-6 / B-7 / DeepSeek 任务级 / 真实上传 / Stage C-E / V3-6/V3-7 均未授权。

## 5. 仍需用户明确授权（不属本闭环范围，与独立审查 §8 一致）

1. B-5 真实 fresh 六视频分母的高风险实施授权。
2. DeepSeek 用于 B-5 任务级 Provider 的高风险授权（含真实项目派生文本上传）。
3. B-6 宿主语义审查的实施授权。
4. B-7 独立实施出门审计的实施授权。
5. Route 2 实施的独立授权（17-route-2-replan.md:97-103）。
6. Stage C / D / E、V3-6 / V3-7 的实施授权。

## 6. 改动文件清单

权威源（4 份，仅在边界内追加）：

- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-development-plan.md`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-acceptance-plan.md`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-preimplementation-audit.md`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py`

包（20 份，清空重建）：

- `docs/active/project/external-audit-package/01..19-…` 19 份载荷
- `docs/active/project/external-audit-package/AUDIT_MANIFEST.md`（重写）

本闭环报告（1 份）：

- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/internal-self-verification-b5-closure-2026-10-14.md`

合计改动 25 份文件；不修改任何产品代码、合同 schema、fixtures、注册表、源凭证；不 commit / push。

## 7. 新 manifest 自身 SHA（仅 handoff 留痕，不参与判定）

```text
efb40865ce0aab4ad5e0b77b9250c497338f5050566d4e4610492108a8eaa54a  AUDIT_MANIFEST.md
```

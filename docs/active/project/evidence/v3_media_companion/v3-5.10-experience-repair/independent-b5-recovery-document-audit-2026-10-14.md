# V3-5.10 B-5 恢复文档独立审查（仅文档 / 只读）

日期：2026-10-14。审查人：与主干隔离的独立审查代理（同工作树、`docs/active/project/external-audit-package/` 之外）。
范围：`docs/active/project/external-audit-package/` 平铺 20 文件包（19 载荷 + `AUDIT_MANIFEST.md`）的事实一致性、合规性、授权边界。
不运行产品代码、不调用 Provider / Runtime / Chrome / 真实上传；SHA-256 与 JSON 解析仅使用 `sha256sum` 与 Python 3 标准库（`hashlib` / `json`），schema meta 与负例 fixture 使用 PyPI `jsonschema.Draft202012Validator`。
不修改任何源文档、合同、fixtures、注册表、源凭证，不实施 B-5，不 commit / push。

## 1. 总体决定

- **DOCUMENT 状态：CANDIDATE CONDITIONAL GO（含 3 项 Major、要求修订 manifest + 重新对源校验后方可认为冻结）**。
- **B-5 实施决定：FAIL/REPLAN**（按权威状态词，未升格）：`stage-b-b5-route-2-risk-stop-2026-10-14.md` 显示 B-5 真实 fresh 仍未通过，本独立审查包不实施、也不授权任何 Chrome / Runtime / Provider 启动。
- **B-6 宿主语义审查、B-7 独立实施出门审计、Stage C/D/E、V3-6/V3-7：仍 NO-GO。**
- 本审查包未撤销既有"DeepSeek 仅凭据库导入、`selected=false`、不自动切换、不真实项目派生上传"任何一条边界（见 §6）。
- 用户当前是否已授权 DeepSeek 任务级选择与真实项目派生 transcript / OCR / vision-caption 文本上传：**未授权**（按落盘证据：仅 2026-10-14 已授权"密钥迁移 + 桌面 dsKey.txt 导入"；B-5 任务级使用与文本上传仍待高风险授权）。

## 2. 复查项目边界（明确不扩展）

- 不运行 Chrome；不发声；不调用 Provider。
- 不下载、不上传真实视频/音频/帧/Cookie/密钥/本地路径。
- 不修改 product code、不修改 fixtures、不修改 schema、不重设数据库 / Chrome profile。
- 不修改任何源 PRD / 架构 / 开发计划 / 验收计划 / Stage Gate / V3-5.10 parent plan 等权威文件的第 18.1 / 1 / 2309 / 8.20.12a / 27 / 末尾块笔记。
- 不实施 B-5；不动 `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py`、`synthesis.py`、`media_cache.py`、`portal_settings.py`（已存在但属于产品代码，本审查不执行）。
- 不删除或回滚主工作树已存在改动（`AGENTS.md` 改写、`apps/chrome-extension/chrome-mv3-unpacked/chunks/` 删除 86 项、未跟踪产品文件 49 项均属于用户/前置会话的进度，本审查唯一可写文件仅为本报告路径）。

## 3. 文件层 — 平铺性与 SHA-256

### 3.1 目录平铺与总数

- `docs/active/project/external-audit-package/` 平铺、无子目录、无 `batch/`。
- 20 个文件：19 个 `01..19` 编号载荷 + `AUDIT_MANIFEST.md`，与本包 manifest 自述一致。
- 不在范围：包内未重复出现 V3-5.1 既有审查包；V3-5.1 既有审查包仅留存于备份目录 `evidence/v3_5_1_audit_package_backup/`（21 文件，含 19 源文件 + 自身 `AUDIT_MANIFEST.md` + `README.md`），未在本包混合。

### 3.2 19 个载荷 SHA-256 逐项复算

| # | 文件 | Manifest 声明 | 实际 `sha256sum` | 匹配 |
|---:|---|---|---|:-:|
| 01 | 01-audit-request.md | `8ac4ad45…445651cc` | `8ac4ad45…445651cc` | ✓ |
| 02 | 02-prd-status-drift-correction.md | `99d17bbe…636dc1` | `99d17bbe…636dc1` | ✓ |
| 03 | 03-architecture-status-drift-correction.md | `9467aaf8…b1cfa1` | `9467aaf8…b1cfa1` | ✓ |
| 04 | 04-development-plan-status-drift-correction.md | `5416fcba…816d0e` | `5416fcba…816d0e` | ✓ |
| 05 | 05-acceptance-plan-status-drift-correction.md | `c62bfb7e…4942a8b` | `c62bfb7e…4942a8b` | ✓ |
| 06 | 06-stage-gate-status-drift-correction.md | `dc0c1a64…2d6d882` | `dc0c1a64…2d6d882` | ✓ |
| 07 | 07-v3-5.10-parent-plan-correction.md | `c575a612…18b5a34` | `c575a612…18b5a34` | ✓ |
| 08 | 08-b5-recovery-development-plan.md | `7e644768…35ea002` | `7e644768…35ea002` | ✓ |
| 09 | 09-b5-recovery-acceptance-plan.md | `3bfb93b7…f298441` | `3bfb93b7…f298441` | ✓ |
| 10 | 10-b5-recovery-preimplementation-audit.md | `6b27b591…28dd80d` | `6b27b591…28dd80d` | ✓ |
| 11 | 11-v2.schema.json | `3d6519df…42f7fc99` | `3d6519df…42f7fc99` | ✓ |
| 12 | 12-v2.1.schema.json | `39b2061f…19ec231` | `39b2061f…19ec231` | ✓ |
| 13 | 13-six-video-registry.json | `25331486…ca8f439` | `25331486…ca8f439` | ✓ |
| 14 | 14-route-2-contract-fixtures.json | `3d24bb4a…d604982` | `3d24bb4a…d604982` | ✓ |
| 15 | 15-route-2-fixture-verifier.py | `62de319b…4ef77a0` | `62de319b…4ef77a0` | ✓ |
| 16 | 16-b5-risk-stop.md | `27da35bf…2f338cc` | `27da35bf…2f338cc` | ✓ |
| 17 | 17-route-2-replan.md | `f26501f8…bdcc8fc` | `f26501f8…bdcc8fc` | ✓ |
| 18 | 18-deepseek-strict-exit.md | `7d3925d2…3687a30` | `7d3925d2…3687a30` | ✓ |
| 19 | 19-chat-provider-secret-migration.md | `6d00d7c8…f2d5232e` | `6d00d7c8…f2d5232e` | ✓ |

结论：19 个 `01..19` 编号载荷 SHA-256 全部与 manifest 表一致，逐项通过。
Manifest 自身的字节 SHA：`b1e788904036d961641aeafa1474f6a564cb59e74be8980f8a0c5bdca76f03c8`（见 §3.4）。

### 3.3 顶层 SHA-256（Major #1）

Manifest §1 声明：

> `cf63f9e4d6935d04c8e48039f93d1e22cccaf776b52905b41890e50836adf692`

按 manifest 自述"按上表顺序拼接 19 个 SHA-256 字符串再 SHA-256"，独立复算（Python 3 `hashlib`，hex 字符串级联）：

- hex 字符串按 `01..19` 顺序级联后 SHA-256 → `031a746e8b4e14ae896b6fd3a4831db4d7c810239360af8dd967af51c2f4799a`
- 二进制 digest 级联后 SHA-256 → `63a5a33de344de98f9683990165bd4383b37c576c9f0959a78a0d2dc0a08f021`
- hex 字符串 + `\n` 分隔 → `b68b4b8422584d2ca74beaab47e37d35048a5b3cc101d5275ed6d3573638aa83`

三种拼接策略均与 manifest 顶层 `cf63f9e4…36adf692` **不匹配**。19 项载荷 SHA 各自匹配，仅"顶层"失配。Major 决定：manifest 顶层哈希属不可复算自我声明，不得判为通过；要么删除该字段，要么定义明确输入约定（hex/binary、是否带分隔）并由独立脚本固化输出。

### 3.4 manifest 自 SHA 字段（Major #2）

Manifest §5 声明：

> 写入完成后本 manifest 的字节 SHA-256（在最后一次写入结束时复算）：`db0bcb3eaaefc45010167658874f9dfebd823734af667a6316467c80b6590e1c`

按 manifest 当前 on-disk 文件独立 SHA-256 复算：

```
b1e788904036d961641aeafa1474f6a564cb59e74be8980f8a0c5bdca76f03c8  AUDIT_MANIFEST.md
```

manifest 声明值 `db0bcb3e…90e1c` ≠ 当前 on-disk `b1e78890…f03c8`，且 manifest §5 自述"在最后一次写入结束时复算"——即"写入完成 → 计算自身 SHA → 写回自身"。**任何后续任何字节变动（包括写回 SHA 本身）都会再次让声明值失效**，是构造上自我引用的逻辑错误：写入动作改变被读取对象的值。Major 决定：不得把该字段当作可通过校验的事实；建议从 manifest 中删除该字段（推荐），或改为记录"preimage 内容清单"（如"包含 19 载荷 + manifest 其余章节按 §X/§Y/§Z 排序后的字节 SHA"），并明确说明此 preimage 与 顶层 §1 哈希的关系、不再尝试把 §5 字段当作通过/不通过的二元开关。

### 3.5 权威源与包副本字节等价（Major #3）

Manifest §4 自述："包内文档 SHA-256 与 `evidence/v3_media_companion/v3-5.10-experience-repair/` 源文件 SHA-256 一致。"

逐项复算源 vs 包：

| 源文件 | 源 SHA | 包 SHA | 一致 |
|---|---|---|:-:|
| `contracts/v3_media_grounded_comprehension_v2.schema.json` | `3d6519df…2f7fc99` | `3d6519df…2f7fc99`（包 `11-…`） | ✓ |
| `contracts/v3_media_grounded_comprehension_v2_1.schema.json` | `39b2061f…9ec231` | `39b2061f…9ec231`（包 `12-…`） | ✓ |
| `evidence/.../stage-b-b5-recovery-development-plan.md` | `a2836942…ee0547` | `7e644768…5ea002`（包 `08-…`） | ✗ |
| `evidence/.../stage-b-b5-recovery-acceptance-plan.md` | `ead602b9…e51812` | `3bfb93b7…f298441`（包 `09-…`） | ✗ |
| `evidence/.../stage-b-b5-recovery-preimplementation-audit.md` | `8ef848ea…5f5f57d` | `6b27b591…8dd80d`（包 `10-…`） | ✗ |
| `evidence/.../stage-b-route-2-contract-fixtures.json` | `3d24bb4a…d604982` | `3d24bb4a…d604982`（包 `14-…`） | ✓ |
| `evidence/.../stage-b-six-video-registry.json` | `25331486…ca8f439` | `25331486…ca8f439`（包 `13-…`） | ✓ |
| `evidence/.../verify-stage-b-route-2-contract-fixtures.py` | `62de319b…4ef77a0` | `62de319b…4ef77a0`（包 `15-…`） | ✓ |

三份 B-5 文件（08 / 09 / 10）源与包字节不等，差异定位（`diff` + `cmp -l`）：

- 包 08 / 09 / 10 标题级 `Stage B ` 前缀被删（源：`# Stage B B-5 恢复详细开发计划（V3-5.10）`；包 08：`# B-5 恢复详细开发计划（V3-5.10）`）。
- 多处中文标点弯引号 / 全宽空格在源（弯引号）与包（直 ASCII 引号、"是""等括号）之间被规范化。

注意：本次审查既不修改源、也不修改包；这是源头不一致的现状报告。判断维度：

- **包内 19 载荷互相之间 + 与 manifest 表完全一致**（§3.2）。
- **包与权威源不一致出现在 B-5 三件文件**（08 / 09 / 10）；其他 16 个载荷与权威源一致。
- manifest §4 的"一致"断言**对 B-5 三件不成立**，属重大断言错误。

Major 决定：manifest §4 应分两半陈述——"11/12/13/14/15 五个源契约文件字节与包一致"（真）+ "B-5 08/09/10 三件文件包与源不一致，已知差异为标题前缀与中文标点规范化"（必须披露）。不得用"包一致"模糊含混、也不得把 §4 当作通过条件。

## 4. 文档内容侧 — 状态词与权威源对账

### 4.1 02/03/04/05/06/07 与权威源块的对应

所有六份纠偏笔记在源文件中确实存在、且位置与 manifest §4 引用一致：

- `01-prd.md:2275`：`> **2026-10-14 V3-5.10 子阶段状态纠偏**（仅修正当前权威状态词，不改写历史证据）` — 对应包 02。
- `02-architecture.md:5`：同一标题 — 对应包 03。
- `03-development-plan.md:2311`：`> **2026-10-14 V3-5.10 实施计划状态纠偏**` — 对应包 04。
- `04-acceptance-plan.md:2186`：`#### 8.20.12a V3-5.10 Stage A/B 验收状态冻结（2026-10-14）` — 对应包 05。
- `stage-gates/v3-media-companion.md:281`：`## 27. V3-5.10 子阶段状态冻结（2026-10-14）` — 对应包 06。
- `design/v3-5.10-media-experience-repair-plan.md:75`：`> **2026-10-14 状态冻结**` — 对应包 07。

### 4.2 状态词一致性

独立复算六个纠偏笔记内文字，需与最新证据一致：

- Stage A 固定负向旅程 NJ-01..NJ-10：LIMITED PASS ✓（出处：`stage-a-final-independent-exit-audit-2026-10-13.md` Fatal=0 / Major=0 / Minor=3，单 BVID `BV1hMpE6FEXG`，Orca `task_b307e1598b9e`）
- Stage B B-0：PASS（合同冻结）✓
- Stage B B-1..B-4：LIMITED PASS candidate ✓
- Stage B Route 2（确定性 brief composer）：文档 CONDITIONAL GO + 实现 LIMITED PASS，但 **B-5 真实 fresh 六视频分母仍 FAIL/REPLAN**（出处：`stage-b-b5-route-2-risk-stop-2026-10-14.md` + `BV1pohR6rEEh` `V3510B_BRIEF_LENGTH_INVALID` × 2 + claims cardinality 不通过）✓
- DeepSeek strict adapter DS-1..DS-5：LIMITED PASS（20/20 schema 合规，结构成功仅证明 JSON 形状、不证明内容正确）✓
- Chat Provider 默认 MiniMax；DeepSeek 已通过 Windows Credential Vault 安全导入、`selected=false`；"保存 ≠ 选择"；首次使用不诱导、不自动切换 ✓
- B-5..B-7、Stage C/D/E、V3-6/V3-7：NO-GO ✓

02..07 与 V3-5.10 parent plan 末块的措辞在六处一致，无相互冲突；Minor：02..05 包文件内的措辞与源块在 2026-10-14 状态纠偏块的字符细节上略有差异（标点、空格、用词），实质意义一致。

### 4.3 B-5 三件内容侧审查

08 恢复开发计划：

- 固定 6 BVID：`BV1pohR6rEEh / BV1hMpE6FEXG / BV1VHHe6kEH3 / BV1SDHy6aEiB / BV1vSHD6tEsM / BV1FCps68EGf`（08:32-39）；与 13 注册表完全一致（已独立以 `(bvid,order)` 元组双向核验：`expected == actual → True`）。
- fresh 隔离：`freshIsolationRequired = ["runtime","database","chromeProfile","task"]`（13:`freshIsolationRequired`）+ 08:74 "6 个 BVID 各自 fresh Runtime/database/chrome-profile/task" ✓
- 单任务锁单一 Provider：08:22、09:9、10:28 均禁止跨 Provider 拼接 / 隐式 fallback / 最佳 N 选一 ✓
- Chrome `--mute-audio`：08 表格 6 行 + 13:`chromeRequiredFlags` + 09:23 MR-04 ✓
- 0 原始视频/音频/帧/Cookie/密钥/本地路径上传：08:15、08:97-100（"Cookie/密钥/原始视频/音频/帧/本地路径/本地 secret path 始终为 0 上传"）✓；09:11、09:25（MR-05/06）✓；10:43-46（raw upload counters）✓
- V2.1 路径：`grounded-comprehension-v2.1/<taskId>/revision-<revision>/<catalogHash>.json`，V2 字节保留，V1 不动（08:26、08:66-68、11 vs 12 schema 并存）✓
- 失败码：08 与 09 与 10/11 列了一致 allowlist：`V3510B_BRIEF_LENGTH_INVALID / V3510B_BRIEF_RAW_PREFIX` 仅触发 composer；其余 fail-closed ✓
- B-6 / B-7 门禁：08:81-94 明确 B-5 出门并不取代 B-6 与 B-7；B-7 出来后方可入 Stage C ✓

注意：08 / 09 文档主题只在"恢复实施边界"范围，不覆盖 Chromium 实际启动、Provider 实际请求、真实 fresh 跑动。任一项必须等用户单独高风险授权。

接受：08 / 09 / 10 内容侧作为冻结候选文档是连贯的；唯一不通过项是它们与权威源字节不等价（§3.5）。

## 5. 合同契约与验证器（11-15）

### 5.1 Schema 独立复算

- `v3_media_grounded_comprehension_v2.schema.json` (包 11)：`Draft202012Validator.check_schema(schema)` 通过 ✓
- `v3_media_grounded_comprehension_v2_1.schema.json` (包 12)：`Draft202012Validator.check_schema(schema)` 通过 ✓
- 二者源契约与包字节一致（§3.5 ✓）。

### 5.2 Fixtures 复算

- P01（provider，origin=provider, sourceClaimIds=[]）→ V2.1 错误数 0 ✓
- P02（composer，origin=deterministic_claim_composer, sourceClaimIds 三项）→ V2.1 错误数 0 ✓
- V2 schema 不接受 origin/sourceClaimIds（对 P01 报 2 错）— 与设计预期相符：V2 与 V2.1 路径字节保留，V2.1 路径独占新字段（08:26、09:29 ✓）
- N01（composer + 1 source_claim）：V2.1 报 `[…] is too short`（`maxItems=3`、对 `minItems=2` 落空）→ 拒绝 ✓
- N07（composer 被改为 origin=provider，但 sourceClaimIds 非空）：V2.1 `allOf` 分支 `then.sourceClaimIds.maxItems=0` 触发拒绝 ✓（"['claim_xxx', …] is expected to be empty"）
- 10 个负例 caseId 完整对齐 `V3510B21-N01..N10` ✓

### 5.3 verifier 复算

- 期望输出：`{"schemaMeta":"PASS","positiveInstances":"2/2 PASS","schemaNegatives":"2/2 PASS","registry":"10/10 present","implementationPending":[8 个非 schema_and_semantic 层 caseId],"implementationAuthorized":false}`。
- 但 `python3 15-route-2-fixture-verifier.py` 在本包目录直接运行 `StopIteration`（Minor #1）。

根因：verifier 既按"原证据目录"约定查找（`HERE/stage-b-route-2-contract-fixtures.json` 找不到 → fallback `HERE/14-route-2-contract-fixtures.json` 命中），又按"原证据目录"约定查找 schema（`ROOT/contracts/v3_media_grounded_comprehension_v2_1.schema.json` 在 `parents[3]/contracts/...` 路径不存在 → fallback `HERE/10-v2.1.schema.json` — 而包内是 `12-v2.1.schema.json`，**该 fallback 也不命中**）。

修复建议（本审查不修改 verifier，仅记录）：
- 将 `HERE / "10-v2.1.schema.json"` 改为 `HERE / "12-v2.1.schema.json"`，或在前置回路中按列表 `["contracts/...","12-v2.1.schema.json"]` 顺序查找。
- 这是"包 = evidence 移植"的脚本兼容问题；不影响 schema 本身的 meta-validity，也不影响 P01/P02/N01/N07 的内容验证（已用上一节方法独立确认）。

### 5.4 注册表独立性（13）

- 字段完全：schemaVersion、sources、allowedFinalDispositions、positiveDisposition、maximumBlockedForStageExit=1、substitutionAllowed=false、crossRunArtifactReuseAllowed=false、freshIsolationRequired=["runtime","database","chromeProfile","task"]、chromeRequiredFlags=["--mute-audio"]。
- 6 条 sources 的 `(bvid, order)` 集与 08:32-39 完全一致：✓
- 这与 V3-5.10 parent plan 第 34 行所述"6 个固定 BVID"的可达性保持只读约定，禁止"因为访问受限"从分母移除（08:43、10:49 显式声明）✓

## 6. 用户授权状态盘点（落盘证据）

逐条对照 `01..19` + 源文件中可核对的授权落点：

| 已落盘授权记录 | 是否包含下列范围 | 范围 |
|---|---|---|
| `01-audit-request.md`、`17-route-2-replan.md:97-103` | 引用 `approved V3-5.10 Stage B B-0..B-7 implementation` 作为既有授权 | 仅覆盖 Stage B 设计与文档冻结；不替代 B-5 真实 fresh 与 B-6/B-7 出门审查 |
| `19-chat-provider-secret-migration.md:3, 30-31` | 用户明确批准迁移 Chat Provider 密钥到系统凭据库 + 从桌面 `dsKey.txt` 导入 DeepSeek | 仅迁移 + 导入；**不**包含自动切换、**不**包含真实项目派生文本上传 |
| `18-deepseek-strict-exit.md:43, 45-48` | "B-5 必须等待用户在 Settings 中手动完成 DeepSeek 配置、选择 `deepseek-chat`、执行严格能力测试并显式切换" | DeepSeek 任务级启用条件被进一步收紧为 Settings 内手动 + 显式切换；当前 Settings UI 状态未触发；只授权过的密钥迁移 ≠ 任务级使用 |
| `16-b5-risk-stop.md` 与 `08-b5-recovery-development-plan.md:3, 79, 106`、`09-b5-recovery-acceptance-plan.md:69-71` | B-5 真实 fresh 与真实项目派生文本上传必须由用户**单独高风险授权**才可启动 | 当前**没有**此授权 |

结论：

- **未授权**事项：
  - 启动 B-5 真实 fresh（含 Chrome、Runtime、Provider、音频、`--mute-audio` 实例、不混批）。
  - 单任务选择 DeepSeek 为 Chat Provider 之外的 B-5 Provider（且包括把真实项目派生 transcript / OCR / vision-caption 文本送到 DeepSeek `deepseek-chat + beta strict tool`）。
  - B-6 宿主语义审查与 B-7 独立实施出门审计的实施授权。
  - Stage C / D / E 的实施授权。
  - V3-6 / V3-7 的实施授权。
- **已授权**事项：仅"密钥迁移到 OS Credential Vault + 从 `dsKey.txt` 安全导入 DeepSeek + 文档冻结"。

任何以此审查通过为由扩张为"V3 PASS / Stage B PASS / B-5 PASS / Chat-Know PASS"均为不实扩解。

## 7. Findings-first 分类

### FATAL — 0

无致命缺陷：
- 19 载荷 SHA-256 与 manifest 表逐项匹配；
- 11 / 12 / 13 / 14 / 15 schema + fixtures + 注册表与源字节一致；
- 02..07 状态纠偏笔记与源块语义对齐；
- 不引入 / 不创造任何 provider 自动切换、跨 Provider 拼接、最佳 N 选一、阈值降低、隐式 fallback、原始视频/音频/帧/Cookie/密钥/本地路径上传。

### MAJOR — 3

1. **AUDIT_MANIFEST.md §1 顶层 SHA-256 与按 manifest 自述规则复算不一致**（§3.3；manifest:31）。声明 `cf63f9e4…36adf692`，独立复算三种拼接均不符（hex 级联 `031a746e…`、`binary digest 级联 63a5a33d…`、hex+\n 分隔 `b68b4b84…`）。要求修订方案：(a) 删除该字段；或 (b) 重新定义拼接规则并固化脚本；当前不得作为"包通过"的二元开关。
2. **AUDIT_MANIFEST.md §5 自 SHA 字段属自引用逻辑错误**（§3.4；manifest:65）。声明 `db0bcb3e…90e1c`；on-disk `b1e78890…f03c8`；按 manifest 自述"在最后一次写入结束时复算"意味着任何后续动作都会让该字段失效。建议删除该字段（推荐）；或改为"preimage 清单 + 该 preimage 的固化字节 SHA"并明确"不参与顶层"。
3. **08 / 09 / 10 三份 B-5 文件与权威源字节不一致**（§3.5）。manifest §4 自述"包内文档 SHA-256 与源一致"对该三件不成立；差异为标题前缀 `Stage B ` 被删 + 中文标点 / 全宽空格被规范化。**注意**：源差异属于用户前置会话的进度，不能据此回滚源；要求：(a) manifest §4 改写为分项陈述；(b) 三件文件如要保留"包与源字节一致"语义，须决定哪一份为真，并把"另一份"明确标记为"已知差异版"。**当前审查不替用户做该决定，仅作为发现报告**。

### MINOR — 3

1. **`15-route-2-fixture-verifier.py:26` schema 文件 fallback 名与包命名不一致**（§5.3）。直接 `python3 15-route-2-fixture-verifier.py` 在本包目录下 `StopIteration`，无法作为随包即用的校验器。建议修 `HERE / "10-v2.1.schema.json"` → `HERE / "12-v2.1.schema.json"` 或顺序回退到 contracts 路径；不替代 §5.1 / §5.2 的独立方法。
2. **B-5 09-B-5 的 acceptance 9:25（MR-06 描述）使用"Sqlite 中无明文 API key；OS Credential Vault 完整"作为门槛条件**，但未给出可独立复算的脚本命令（如 `scripts/secret-scan.py` 路径）。10:46 提示"templates/secret_scan.py 与 audit-subagent secret scan 在真实 run 后必须 0 命中"，脚本具体位置未在包内、也未在 11-19 中固化结论。建议把抽样命令固化到 09 或新增 MR-13，不阻断 B-5 文档冻结。
3. **08-B-5 dev 计划 DEV-3（08:65-69）描述 `service.py` 与 `quality.py` 的实现边界**，但包内未附两文件的当前字节或契约指纹，运行态变化不可复算。建议在 DEV-1（08:47-54）出门条件中追加"质量/服务两文件当前 SHA-256 落盘 + 与 stage-a 既有实现差异列表"。不阻断 B-5 文档冻结。

### 额外观察 — 非阻断

- `08-B-5 dev plan:39` BVID 6 行表格与 §4 不变量（substitutionAllowed=false / crossRunArtifactReuseAllowed=false）在源文件 13 与包 13 完全一致；✓
- `16-b5-risk-stop.md:34-36` 与 `08-B-5 dev plan:7` 与本审查一致认定"继续到剩余五视频不会关闭第一段固定分母" ✓
- `17-route-2-replan.md:97-103` 的授权边界显式将"已批准 Stage B 实施"与"用户须显式批准 Route 2 实施"做拆分；本审查认可此拆分 ✓
- `04-acceptance-plan-status-drift-correction.md:12` 与 `06-stage-gate-status-drift-correction.md:13` 显式"用户对 DeepSeek 任务级选择与真实项目派生文本上传必须另行高风险授权"——与 §6 表一致 ✓
- 主工作树未跟踪文件：49 个；其中 `services/local-runtime/navia_runtime/modules/media_companion/comprehension/quality.py`、`synthesis.py`、`media_cache.py`、`portal_settings.py` 与测试 `test_v3_grounded_comprehension_v2.py`、`test_v3_media_portal_settings.py`、`tests/conftest.py` 已被前置会话写出；本审查不修改、不评估这些产品代码（仅记录在 `D ` 与 `??` 状态范围内）。AGENTS.md 修改（追加 `--mute-audio` 行 + project-stage-workflow 引用行）也与本审查结论一致（不冲突、不构成回退面）。
- 主工作树中 `apps/chrome-extension/chrome-mv3-unpacked/chunks/` 86 项 `D ` 状态均为 `wxt` 构建产物删除，属于用户前置会话进度；本审查未触及、不得回退。

## 8. 仍需用户明确授权（不属本审查包范围）

下列高风险授权未在落盘证据中存在；本审查拒绝将其归并到任何既有授权：

1. **B-5 真实 fresh 六视频分母的高风险实施授权**：在 6 个固定 BVID 上各跑一次 `attempt_fresh`，含 `Runtime/database/chrome-profile/task` 全 fresh 隔离 + `--mute-audio` + 单任务锁单 Provider + 真实 Chat Provider + 派生 transcript / OCR / vision-caption 文本上传。授权必须显式包含"接受音频 0 命中、原始视频/音频/帧/Cookie/密钥/本地路径 0 命中、>= 2 个 blocked 触发 NO-GO"这三条底线。
2. **DeepSeek 用于 B-5 任务级的 Provider 高风险授权**：在 Settings 中明确选择 `deepseek-chat + beta strict tool`、并在任务级 receipt 中以 DeepSeek 为唯一 Provider，且上传真实项目派生文本到 DeepSeek。当前 19-chat-provider-secret-migration.md 显式排除此项。
3. **B-6 宿主语义审查的实施授权**：含独立宿主模型 ID、prompt SHA-256、session ID，每维度评分 ≥ 4，1 sentinel 重复验证。
4. **B-7 独立实施出门审计的实施授权**：与 B-6 责任人 + B-5 实现责任人均不同。
5. **Route 2（确定性 brief composer）实施授权**：在 B-5 之外仍要求单独授权（17-route-2-replan.md:97-103），不得据本审查包放大。
6. **Stage C / D / E、V3-6 / V3-7 的实施授权**：均 NO-GO。

## 9. 命令与未运行边界（只读、可复算）

下列命令在本审查中已运行（仅 stdlib 与 `jsonschema`），结果与本报告一致：

```bash
# 19 载荷字节 SHA-256 逐项
cd docs/active/project/external-audit-package
sha256sum *.md *.json *.py | sort -k 2

# 顶层 SHA-256 复算（三种拼接策略均与 manifest 不一致 — 见 §3.3）
python3 -c "..."   # hex 级联 / binary digest 级联 / hex+\n

# Schema meta-validation
python3 -c "from jsonschema import Draft202012Validator; ..."

# Fixtures positive + N01 + N07
python3 -c "..."   # 见 §5.2

# BVID 注册表对齐
python3 -c "..."   # 见 §5.4

# 源 vs 包字节 SHA 对照（5 个一致 / 3 个不一致 — 见 §3.5）
sha256sum /mnt/c/workSpace/navia/docs/active/project/contracts/v3_media_grounded_comprehension_v2*.schema.json \
          /mnt/c/workSpace/navia/docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-*.md \
          /mnt/c/workSpace/navia/docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json \
          /mnt/c/workSpace/navia/docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-six-video-registry.json \
          /mnt/c/workSpace/navia/docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py
```

未运行（按 §2 边界）：

- 任何 Chrome、`--mute-audio`、Xvfb 实例、音频发声。
- 任何 Provider（M3 / deepseek-chat / 任何候选）真实调用。
- 任何真实 Runtime / `pytest` / `npm test` / `WXT` 构建。
- 任何真实视频 / 音频 / 帧 / Cookie / 密钥 / 本地路径上传；任何 `dsKey.txt` 读入。
- 任何 B-5 / B-6 / B-7 / Stage C / D / E / V3-6 / V3-7 的实施动作。
- 任何文件删除 / git commit / git push。

## 10. 下一步（按本审查建议）

- 主干实施代理人应在落盘前**至少**回答以下三件修订，再认为 AUDIT_MANIFEST.md 可以作为冻结：

  1. 顶层 SHA-256 字段：或删除、或以独立脚本固化——本审查已留三种"拼接候选"作为诊断锚点。
  2. 自身 SHA 字段：删除；或改为 preimage-清单的字节 SHA。
  3. §4 关于"包与源一致"的断言：分项陈述；08 / 09 / 10 标注差异或选定真本。

- 在修订完成、03 项 Major 关闭后，本审查可由独立审查代理对该 manifest 重做一次 §3.3 / §3.4 / §3.5 复算并出新报告，再走用户下一步授权流程。本轮不替主干做修订、亦不替用户做决策。

- 用户未单独下达任何高风险授权前，本审查拒绝把"manifest 通过"扩大为"B-5 / Stage B / V3 PASS"；这是发现报告，不是授权扩容。

## 11. SHA-256 留痕（节选）

本审查复算所用命令与 §3 / §5 一致；以上结论对所有字节指纹均已独立验证或在文中标注尚未一致项。仅文件 SHA（本节首/末次复算）：

```
8ac4ad45a804aab71630499ea4785692f394ec8f872e91f1414aa0fd445651cc  01-audit-request.md
99d17bbee4acd4300aeac432c861bfb05b1d6aa6c0157640c1fec5a7bb636dc1  02-prd-status-drift-correction.md
9467aaf8f7b088c47c949c2a604f45f44bdcabd1b402753771fa6439d5b1cfa1  03-architecture-status-drift-correction.md
5416fcba76a00349389502fb0050dfa3e5baabe0c25a34178edb8605c5816d0e  04-development-plan-status-drift-correction.md
c62bfb7e6794fe33b14b7343d3b2a8b00f039ef29616425a9223059314942a8b  05-acceptance-plan-status-drift-correction.md
dc0c1a64f943c7826681a60cbac9716f35d5dee1f7e836595fbb2c7d12d6d882  06-stage-gate-status-drift-correction.md
c575a61213bcaeda98cb0850a9ecb728d71c0d8ce61ffe34e1cf46ca318b5a34  07-v3-5.10-parent-plan-correction.md
7e6447685607fd89a719bb1b542d6007c7ceb1538027b7c08b60db47735ea002  08-b5-recovery-development-plan.md
3bfb93b758c9836384dae75fef1874d9e33bd0d404779a0b3ff38a8e3f298441  09-b5-recovery-acceptance-plan.md
6b27b5916ff9461b311271b060f2bc00d3f57483835667992ccce52f2c8dd80d  10-b5-recovery-preimplementation-audit.md
3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99  11-v2.schema.json
39b2061f5ee3dc564b98f1a3c6b81088261ae7d23050cddc337c9c01519ec231  12-v2.1.schema.json
25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439  13-six-video-registry.json
3d24bb4aed25eea1862cfb8590d6efa13510771b6a72791e10bcfa1a3d604982  14-route-2-contract-fixtures.json
62de319b41b6747d6bf461de01ff1efaba32883a948797d8bf2ebe0a44ef77a0  15-route-2-fixture-verifier.py
27da35bff982a3f980352074b276493d45104a77863cce62f4288a3d12f338cc  16-b5-risk-stop.md
f26501f839426eee9888ed33eef8c39bd8c24c6bf9696763d73a48047bdcc8fc  17-route-2-replan.md
7d3925d2a830e95f680959b5b311de538ec2b09d57956e1ae0c8575533687a30  18-deepseek-strict-exit.md
6d00d7c82775877770669dc25f7a240b956dde880a34a5c363faebd8f2d5232e  19-chat-provider-secret-migration.md
b1e788904036d961641aeafa1474f6a564cb59e74be8980f8a0c5bdca76f03c8  AUDIT_MANIFEST.md
```

源对照（本审查第 §3.5 / §5.1 复算的字节）：

```
3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99  contracts/v3_media_grounded_comprehension_v2.schema.json
39b2061f5ee3dc564b98f1a3c6b81088261ae7d23050cddc337c9c01519ec231  contracts/v3_media_grounded_comprehension_v2_1.schema.json
a283694280c570744d2707729f0dd1f6a088c416a0b34319bbf26a7ae1ee0547  evidence/.../stage-b-b5-recovery-development-plan.md
ead602b9dde33e3b2161c1120782bde4717ae720e24e632d95a29bc52ce51812  evidence/.../stage-b-b5-recovery-acceptance-plan.md
8ef848ea1c3eccf64f64450ce24d03eec97ec90ca37468999ca64e0a75f5f57d  evidence/.../stage-b-b5-recovery-preimplementation-audit.md
3d24bb4aed25eea1862cfb8590d6efa13510771b6a72791e10bcfa1a3d604982  evidence/.../stage-b-route-2-contract-fixtures.json
25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439  evidence/.../stage-b-six-video-registry.json
62de319b41b6747d6bf461de01ff1efaba32883a948797d8bf2ebe0a44ef77a0  evidence/.../verify-stage-b-route-2-contract-fixtures.py
```

## 12. 决定复述（与 §1 对齐）

- DOCUMENT：CANDIDATE CONDITIONAL GO（保留 manifest 顶层 SHA / 自 SHA / §4 三项 Major 待修；修订后建议独立审查重做一次）。
- B-5：FAIL/REPLAN（按本审查 §4.2 与 §6 盘点）。
- B-6、B-7、Stage C/D/E、V3-6/V3-7：NO-GO。
- Chat Provider 默认：MiniMax。
- DeepSeek：已通过 Windows Credential Vault 安全导入；**任务级启用与真实项目派生文本上传未授权**。
- 用户已落盘授权的范围：仅"密钥迁移到凭据库 + `dsKey.txt` 安全导入 + 文档冻结"；其余 B-5 / B-6 / B-7 / DeepSeek 任务级 / 真实上传 / Stage C-E / V3-6/V3-7 均未授权。

本审查结束。审查人不实施 B-5，不 commit / push，仅落盘本报告。

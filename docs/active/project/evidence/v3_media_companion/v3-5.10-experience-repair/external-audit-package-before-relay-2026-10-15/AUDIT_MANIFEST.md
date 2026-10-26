# AUDIT MANIFEST — V3-5.10 状态纠偏 + B-5 恢复审查包（2026-10-14 修订版）

日期：2026-10-14。范围：V3-5.10 阶段权威状态词纠偏与 B-5 恢复文档独立审查包。本包平铺、20 个文件（含本 manifest），均为只读副本，无子目录、无 batch 子目录。位置：`docs/active/project/external-audit-package/`（canonical AGENTS.md 路径）。V3-5.1 既有审查包完整副本留存于 `evidence/v3_5_1_audit_package_backup/`；本轮与 V3-5.1 不混合。

## 0. 修订说明（相对前一轮独立审查发现的 3 项 Major）

- **Major #1**（顶层聚合 SHA-256 算法不明确、不可独立复算）：**已删除**。本 manifest 仅保留 19 份载荷的逐文件 SHA-256；任何"顶层"或"聚合"概念仅以"19 份独立 SHA-256 表"为唯一形态，不再声明任何基于拼接/级联的不可复算字段。复算方式：`sha256sum 01-… 02-… … 19-…` 逐行核验，0 mismatch 即通过。
- **Major #2**（manifest 自引用 SHA 字段是构造上自我引用逻辑错误）：**已删除**。本 manifest 不再声明自身的"最后一次写入结束时复算"字节 SHA；如需核验 manifest 自身的当前字节 SHA，可用 `sha256sum AUDIT_MANIFEST.md` 由读者自行复算；该值不参与任何通过/不通过判定。
- **Major #3**（08/09/10 三件 B-5 文档与权威源字节不一致）：**已通过先修改权威源再字节一致复制关闭**。权威源 `evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-{development,acceptance,preimplementation-audit}-plan.md` 已于 2026-10-14 修订（在原状态纠偏与边界内追加 MR-06 可复算命令 / quality.py service.py 指纹 / DEV-1 SHA-256 出门条件），本包 08/09/10 为权威源逐字节副本；源 vs 包 SHA-256 全部 0 mismatch（见 §4）。

## 1. 19 份载荷逐文件 SHA-256（唯一核验形态）

| # | 文件 | SHA-256 |
|---:|---|---|
| 01 | 01-audit-request.md | `8ac4ad45a804aab71630499ea4785692f394ec8f872e91f1414aa0fd445651cc` |
| 02 | 02-prd-status-drift-correction.md | `99d17bbee4acd4300aeac432c861bfb05b1d6aa6c0157640c1fec5a7bb636dc1` |
| 03 | 03-architecture-status-drift-correction.md | `9467aaf8f7b088c47c949c2a604f45f44bdcabd1b402753771fa6439d5b1cfa1` |
| 04 | 04-development-plan-status-drift-correction.md | `5416fcba76a00349389502fb0050dfa3e5baabe0c25a34178edb8605c5816d0e` |
| 05 | 05-acceptance-plan-status-drift-correction.md | `c62bfb7e6794fe33b14b7343d3b2a8b00f039ef29616425a9223059314942a8b` |
| 06 | 06-stage-gate-status-drift-correction.md | `dc0c1a64f943c7826681a60cbac9716f35d5dee1f7e836595fbb2c7d12d6d882` |
| 07 | 07-v3-5.10-parent-plan-correction.md | `c575a61213bcaeda98cb0850a9ecb728d71c0d8ce61ffe34e1cf46ca318b5a34` |
| 08 | 08-b5-recovery-development-plan.md | `2efa91af9eec202c63ea549c9f047e8894cb2b7def6675f8cd3fde7abefdb471` |
| 09 | 09-b5-recovery-acceptance-plan.md | `4fb1d3c5fdebb71e0350a75e2d559811191f48c01f382717286c70b32a70bc2b` |
| 10 | 10-b5-recovery-preimplementation-audit.md | `932d5e1def22e6c9d2b37442f92f587ab50c412756b821ffe62c4a9f85f71074` |
| 11 | 11-v2.schema.json | `3d6519df4a9df95d4dcbe150ed6a0cef0d16fada962d61641e9f031242f7fc99` |
| 12 | 12-v2.1.schema.json | `39b2061f5ee3dc564b98f1a3c6b81088261ae7d23050cddc337c9c01519ec231` |
| 13 | 13-six-video-registry.json | `25331486cad5d5ad251e135ae0cba59a46accbe17f37f1883a26da596ca8f439` |
| 14 | 14-route-2-contract-fixtures.json | `3d24bb4aed25eea1862cfb8590d6efa13510771b6a72791e10bcfa1a3d604982` |
| 15 | 15-route-2-fixture-verifier.py | `c4b70708ad0d530568b3e9012d7cc891bdb0ba2babfd08c8d1ec58d085295928` |
| 16 | 16-b5-risk-stop.md | `27da35bff982a3f980352074b276493d45104a77863cce62f4288a3d12f338cc` |
| 17 | 17-route-2-replan.md | `f26501f839426eee9888ed33eef8c39bd8c24c6bf9696763d73a48047bdcc8fc` |
| 18 | 18-deepseek-strict-exit.md | `7d3925d2a830e95f680959b5b311de538ec2b09d57956e1ae0c8575533687a30` |
| 19 | 19-chat-provider-secret-migration.md | `6d00d7c82775877770669dc25f7a240b956dde880a34a5c363faebd8f2d5232e` |

复算命令（独立审查代理逐行核验）：

```bash
cd docs/active/project/external-audit-package
sha256sum 01-audit-request.md \
          02-prd-status-drift-correction.md \
          03-architecture-status-drift-correction.md \
          04-development-plan-status-drift-correction.md \
          05-acceptance-plan-status-drift-correction.md \
          06-stage-gate-status-drift-correction.md \
          07-v3-5.10-parent-plan-correction.md \
          08-b5-recovery-development-plan.md \
          09-b5-recovery-acceptance-plan.md \
          10-b5-recovery-preimplementation-audit.md \
          11-v2.schema.json \
          12-v2.1.schema.json \
          13-six-video-registry.json \
          14-route-2-contract-fixtures.json \
          15-route-2-fixture-verifier.py \
          16-b5-risk-stop.md \
          17-route-2-replan.md \
          18-deepseek-strict-exit.md \
          19-chat-provider-secret-migration.md
```

19 行 SHA-256 与本表逐行一致 → 载荷完整性 PASS；任一 mismatch → FAIL/REPLAN。

## 2. 待审结论（限定词不变）

- 主审查真仍是 V3-5.10 Stage B B-5 真实 fresh 六视频分母的 **FAIL/REPLAN**。
- B-5 文档冻结已完成：B-5 恢复详细开发计划、B-5 恢复验收计划、B-5 恢复实施前审计；外部独立审查尚未完成，B-5 实施 / B-6 宿主语义审查 / B-7 独立出门审计 / Stage C/D/E / V3-6/V3-7 均 NO-GO。
- 限定 PASS 仅是真实状态词；不得扩大为 V3 PASS 或 Chat/Know 通过。

## 3. 审查范围声明

- 本包不包含任何真实 Chrome 启动、Runtime 调用、音频播放、原始视频/音频/帧/Cookie/密钥上传。
- 本包仅含文档冻结、合同 fixtures、6 BVID 注册表与状态纠偏反馈。
- 本包与既有 V3-5.1 审查包不混合；V3-5.1 完整副本留存于 `evidence/v3_5_1_audit_package_backup/`（含 19 源文件 + `AUDIT_MANIFEST.md` + `README.md`），共 21 文件，可独立复算。
- 独立审查报告 `evidence/v3_media_companion/v3-5.10-experience-repair/independent-b5-recovery-document-audit-2026-10-14.md` 不在本包内；本包仅承载其结论所需的载荷与 manifest。

## 4. 源 / 包字节等价（分项陈述）

包内 8 份有独立权威源副本的载荷，逐项复算 `sha256sum` 源 vs 包：

| 包内 | 权威源 | 源 SHA-256 | 包 SHA-256 | 一致 |
|---|---|---|---|:-:|
| 11 | `contracts/v3_media_grounded_comprehension_v2.schema.json` | `3d6519df…2f7fc99` | `3d6519df…2f7fc99` | ✓ |
| 12 | `contracts/v3_media_grounded_comprehension_v2_1.schema.json` | `39b2061f…9ec231` | `39b2061f…9ec231` | ✓ |
| 13 | `evidence/.../stage-b-six-video-registry.json` | `25331486…ca8f439` | `25331486…ca8f439` | ✓ |
| 14 | `evidence/.../stage-b-route-2-contract-fixtures.json` | `3d24bb4a…d604982` | `3d24bb4a…d604982` | ✓ |
| 15 | `evidence/.../verify-stage-b-route-2-contract-fixtures.py` | `c4b70708…92928` | `c4b70708…92928` | ✓ |
| 08 | `evidence/.../stage-b-b5-recovery-development-plan.md` | `2efa91af…db471` | `2efa91af…db471` | ✓ |
| 09 | `evidence/.../stage-b-b5-recovery-acceptance-plan.md` | `4fb1d3c5…0bc2b` | `4fb1d3c5…0bc2b` | ✓ |
| 10 | `evidence/.../stage-b-b5-recovery-preimplementation-audit.md` | `932d5e1d…71074` | `932d5e1d…71074` | ✓ |

复算命令：

```bash
sha256sum \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json \
  docs/active/project/contracts/v3_media_grounded_comprehension_v2_1.schema.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-six-video-registry.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-route-2-contract-fixtures.py \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-development-plan.md \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-acceptance-plan.md \
  docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-b5-recovery-preimplementation-audit.md
```

8 / 8 一致 → 字节等价 PASS；任一 mismatch → FAIL/REPLAN。
其余 11 份载荷（01-07、16-19）无独立权威源副本——它们是审查包自带的请求 / 状态纠偏反馈 / 风险停止 / Replan 文档，本身即审查内容。

## 5. 权威源改动（仅 08 / 09 / 10 / 15；其余源未改）

- 08 `stage-b-b5-recovery-development-plan.md` §5 DEV-1：追加质量/服务两文件当前 SHA-256 落盘与差异列表出门条件。
- 09 `stage-b-b5-recovery-acceptance-plan.md` §2 MR-06：追加可复算命令清单（4 条 bash 块，覆盖 SQLite 明文扫描、receipt 0 命中、audit-subagent secret scan、CSV 抽样核验）。
- 10 `stage-b-b5-recovery-preimplementation-audit.md` §1：新增"实施前指纹基线"小节，列出 `quality.py`（`ca73029c…88997`）与 `service.py`（`579c1d86…3b14a`）当前字节 SHA-256、大小、mtime 与复算命令。
- 15 `verify-stage-b-route-2-contract-fixtures.py`：在 `SCHEMA` fallback 列表追加 `HERE / "12-v2.1.schema.json"`，修复从 `external-audit-package/` 直接运行时的 `StopIteration`。

改动均落在"状态纠偏后第一份冻结开发计划"的边界内，未授权任何 Chrome / Runtime / Provider / 上传动作；不修改 18.1 / 1 / 2309 / 8.20.12a / 27 / 末尾块笔记或既有凭据迁移条款。

## 6. 本 manifest 自身字节

本 manifest 不再声明自身的"最后一次写入结束时复算" SHA（自引用逻辑错误，已删除）。如需核验 manifest 当前字节 SHA，由读者独立运行 `sha256sum AUDIT_MANIFEST.md`；该值不参与任何通过/不通过判定，亦不参与 §1 复算流程。

## 7. 引用路径

- 源 PRD：`docs/active/project/01-prd.md` 第 18.1 节纠偏备注。
- 源架构：`docs/active/project/02-architecture.md` 第 1 节纠偏备注。
- 源开发计划：`docs/active/project/03-development-plan.md` 第 2309 节纠偏备注。
- 源验收计划：`docs/active/project/04-acceptance-plan.md` §8.20.12a 状态冻结。
- 源 Stage Gate：`docs/active/project/stage-gates/v3-media-companion.md` §27。
- 源 V3-5.10 parent plan：`docs/active/project/design/v3-5.10-media-experience-repair-plan.md` 状态冻结块。
- B-5 恢复文档三件均落盘于 `evidence/v3_media_companion/v3-5.10-experience-repair/`：
  - `stage-b-b5-recovery-development-plan.md`
  - `stage-b-b5-recovery-acceptance-plan.md`
  - `stage-b-b5-recovery-preimplementation-audit.md`
- Schema 与 fixtures 源：`docs/active/project/contracts/v3_media_grounded_comprehension_v2.schema.json`、`contracts/v3_media_grounded_comprehension_v2_1.schema.json`、`evidence/v3_media_companion/v3-5.10-experience-repair/stage-b-route-2-contract-fixtures.json`、`stage-b-six-video-registry.json`、`verify-stage-b-route-2-contract-fixtures.py`。

## 8. 通过判据（仅此清单，0 mismatch 即通过）

- §1 19 份载荷 SHA-256 与本地 `sha256sum` 复算 0 mismatch。
- §4 8 份有源副本的载荷 SHA-256 与权威源 0 mismatch。
- `python3 15-route-2-fixture-verifier.py` 在 `docs/active/project/external-audit-package/` 直接运行：`schemaMeta: PASS`、`positiveInstances: 2/2 PASS`、`schemaNegatives: 2/2 PASS`、`registry: 10/10 present`、`implementationAuthorized: false`。
- 目录平铺、无子目录、文件总数 20（19 载荷 + 1 manifest）。

# T03 R3 文档候选内部多轮审计

日期：2026-09-13  
范围：仅文档、JSON Schema 静态读取、T02.2 已封存审计材料只读核对、Draw.io XML/几何检查。未运行产品代码、Runtime、Chrome、旧 production generator 或旧 production validator。

## 1. 审计对象

- 总 PRD、目标架构、总开发计划、总验收计划。
- V2-PX 专项开发验收计划、stage gate、gap companion 与八页 Draw.io。
- T02.2 独立审查及其 T03 input readiness 结果。
- T03 development、acceptance、Validation Profile、Evidence Pipeline ADR、T02.2 disposition 和恢复实施前审计。
- Validation Contracts v4 注册表。

## 2. 第一轮：权威与一致性

| 检查 | 实测 | 结论 |
|---|---|---|
| T02.2 唯一正基线 | runId、snapshot、raw SHA-256、seal SHA-256 在 T03 核心文档一致 | PASS |
| 上游独立审查 | 文件 SHA-256 为 7822bd7fbff0887b22ed1de3091f9bbf0cf76b892befb907c16e90411830c5f6 | PASS |
| 输入 readiness | Fatal 0、Major 0、gaps 空、ready true、Forget 12 trigger/12 recovery | PASS，仅证明输入 |
| 合同版本 | Manifest v5、Report v12、Screenshot v6、Execution v6、Human v3、Validation v4、Architecture Scan v2 | PASS |
| 注册表分母 | 63 RuleId，41 semantic / 22 schema；109 requirement；两组 ID 均唯一 | PASS |
| T03 验收 ID | T03-A01..A14 精确 14 项，无 N/A | PASS |
| 阶段状态 | T02.2 限定 PASS；T03 文档候选/实施 NO-GO；T04/PX-6/RKM blocked；PX-5 reopened | PASS |
| 公共范围 | T03 只新增 P7 证据实体，不修改 P0-P6、Runtime API、Workspace route、规则注册表或 RKM | PASS |

第一轮发现并修复的漂移：

1. stage gate 与 README 仍把 T02.2 写成独立审查 pending。
2. 总开发/验收计划仍把 PX-5 写成未拆分的旧脚本任务。
3. 架构表仍把已冻结 Schema 写成“待实现”，并把 PX-1..4 产品实体误写为未经任何验收。
4. Draw.io 仍显示 R1/R2 未完成，没有表达 T02.2 与 T03 目标 P7 流水线。

上述四项均已同步到 active Markdown 与 Draw.io；历史 T02.1 审查原文未改写。

## 3. 第二轮：对抗性 false-green 审计

| 攻击 | 文档拒绝机制 | 结论 |
|---|---|---|
| 跨 T02.1/T02.2 拼接分母 | T02.2 是唯一 production-positive 输入；旧 T02.1 只能触发 T03-IN-09 | PASS |
| 修改 sealed raw 补事实 | ArtifactReader 重算 seal/path/hash/length，只读输入 | PASS |
| Report 自证 G1-G7 | Report 只由已验证 facts/validation 渲染，不进入 validator 输入 | PASS |
| 缺观察仍成功 | 只允许 CollectionDiagnostic，passed=false，退出 2 | PASS |
| Contract 通过冒充 production | 共用 core，但 reader/profile 分离；production 拒绝 virtual/fixture claim | PASS |
| G4 信任 violations=0 | 从 snapshot Git blob 重建 path/tree 并执行共享 TypeScript AST scanner | PASS（设计） |
| 只列 63 条规则不执行 | 109 contract case + 42 raw/byte/causality mutation + implementation hash | PASS（设计） |
| 自动签署 Human Review | Candidate 固定 61 machine + 2 human pending，G7/final=false | PASS |
| cwd 偶然通过 | CLI 参数入口绝对化，仓库根/脚本目录/临时目录三种回归 | PASS（设计） |
| 只看 T01 exitCode | 必须解析 36 个唯一 assertion ID 和逐项 passed | PASS（设计） |
| Package/Report 自引用 | Renderer 在 Package 前运行；Package 无自身 hash；Invocation 最后写 | PASS |

## 4. Draw.io 独立检查

实测：

    pages=8
    page names=8 unique
    vertices by page=15/17/14/18/13/13/11/11
    edges by page=7/10/7/10/5/0/3/0
    duplicate IDs per page=0（每页标准根节点 0/1 可重复）
    broken source/target/parent references=0
    out-of-1600x900 bounds=0
    rectangle overlap pairs=0

八页分别覆盖目标体验、当前/目标架构差异、入口/路由、保存/Forget 生命周期、共享分层、里程碑、自动/人工验收、出门门槛。颜色含义已统一为绿色已实现/限定通过、黄色待复验、红色待新增/阻塞、蓝色目标边界、紫色外部候选。

本 WSL 环境的 Draw.io AppImage 因 FUSE/libnspr 依赖不能导出位图。XML、几何和文本已检查，但最终视觉方向仍需用户在桌面 Draw.io 中打开确认；这是一项人工审阅义务，不是自动 PASS。

## 5. 最终平铺审计包核验

在本轮文档修订完成后，重新清空并构建 `docs/active/project/external-audit-package/`，实测结果如下：

| 检查 | 实测 | 结论 |
|---|---|---|
| 平铺结构 | 18 个载荷 + 1 个 manifest，共 19 个文件；无子目录 | PASS |
| 清单哈希 | 18/18 平铺副本 SHA-256 与 manifest 一致 | PASS |
| 权威源对账 | 18/18 source path 存在，原始字节与平铺副本一致 | PASS |
| Schema 元校验 | 九份 V2-PX Schema 均通过 Draft 2020-12 `check_schema` | PASS |
| Validation registry | 63 个唯一 RuleId，41 semantic / 22 schema；109 个唯一 requirementId/key，引用 RuleId 与 FailureCode 均在封闭注册表内 | PASS |
| 验收分母 | `T03-A01..T03-A14` 连续且精确 14 项；无 N/A | PASS |
| Draw.io | 8 页；每页 ID 唯一；引用完整；0 越界；0 矩形重叠 | PASS |

审查请求的阅读顺序已与包内实际文件名同步；实施前外部文档审查与实现后独立出门审计已明确为两个不同门禁，前者不能提前满足 `T03-A14`。

## 6. 结论

    Internal round 1: PASS after remediation.
    Internal round 2: PASS at document-design level.
    Fatal: 0.
    Major: 0.
    Minor: 1 (desktop visual review remains pending).

    T03 documentation candidate: READY FOR EXTERNAL PREIMPLEMENTATION REVIEW.
    T03 implementation: NO-GO.

本地自审不具备组织独立性。Claude Code CLI 必须重新核对 PRD、架构、T02.2 基线、A01-A14、无环证据链和 false-green 防线；只有外审 Fatal 0 / Major 0 且用户明确批准，才允许进入 T03 代码阶段。

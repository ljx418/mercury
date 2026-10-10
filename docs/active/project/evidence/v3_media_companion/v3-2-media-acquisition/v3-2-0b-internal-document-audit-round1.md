# V3-2-0b 内部文档审查第一轮

日期：2026-09-22。性质：文档、机器合同、确定性原型和 Draw.io 的内部风险审查；未运行 ASR 候选、未下载候选资产、未修改产品代码。

## 1. 初始结论

第一轮发现 `Major=3 / Minor=3`，不得直接进入外部文档审查。所有问题已在本轮修订后关闭，复核结果为 `Fatal=0 / Major=0 / Minor=0`。

## 2. 发现与闭环

| ID | 严重度 | 问题 | 修订 | 关闭证据 |
|---|---|---|---|---|
| R1-01 | Major | `QualificationRun.evidenceClass` 仅允许 `contract_fixture`，无法承载未来生产候选 | 扩为闭集 `contract_fixture | production_candidate` | Schema meta 与 candidate instance PASS |
| R1-02 | Major | Adjudication 只有自报 summary，可能用重复 bin、同一 review 或 24 条 resolved 结果冒充 48 条独立判断 | 增加两份唯一 review hash、48/24 唯一键、reviewer/adjudicator 独立、分歧记录；计划要求 semantic validator 从原 review 重算 | 43/48、critical=1、47 keys、重复 hash 四个假绿负例均 REJECT |
| R1-03 | Major | 设置原型的 237/239 MiB 与候选清单不一致，磁盘/RAM 只有模糊文案 | candidate manifest 增加平台下载字节和磁盘/RSS/VRAM 政策上限；原型改为 Win 232.33 MiB / Linux 235.24 MiB | manifest 可被 Schema 验证；真实 Chrome 进度显示 `232.33 / 232.33 MiB` |
| R1-04 | Minor | 360/420 视口被表格最小内容宽度撑到 631px | 固定 table layout、长词换行、flex wrap 与 min-width | 四视口 document width 分别 345/405/753/1265，均不溢出 |
| R1-05 | Minor | 文档一度写成 adjudication 可直接晋级质量状态 | 明确 adjudication 只产待审结果，A01..A18 和独立出门审查后由 stage-gate owner 写 `production_qualified` | PRD、架构、开发、验收、威胁模型一致 |
| R1-06 | Minor | “推理阶段网络关闭”缺少跨平台不可证明时的处置 | 改为 OS 可隔离则 deny；否则 socket 观测为硬门槛，不能证明 0 外联即失败 | 威胁模型 fail-closed 文本 |

## 3. 机器复核

- Draft 2020-12 Schema meta：PASS。
- candidate manifest instance：0 errors。
- requirement registry：18；negative cases：18；三元组集合精确相等。
- `passed=true` 关系负例：meaning=43、critical=1、unique keys=47、重复 review hash 均被拒绝。
- Draw.io：8 页；每页 0 重复 ID、0 断裂引用、0 越过 1600x900。
- 原型：四视口、两张真实基线图、Axe serious/critical=0、安装/取消/焦点/回退/盲评必填均通过；临时 Chrome profile 已删除。

## 4. 范围判定

本候选只支撑 V3-2-0b 后续实现和 A06 恢复，不支撑 V3-2-1..7、媒体获取、tabCapture、视频理解、图文大纲或 V3 PASS。B站、YouTube、小红书只能提供通用 `TaskAudioRef`，不能控制 provider、继承权限或继承 B站验收结论。

## 5. 第一轮出门

允许进入第二轮内部文档审查。仍禁止产品代码、候选资产下载、真实候选推理和质量比较。

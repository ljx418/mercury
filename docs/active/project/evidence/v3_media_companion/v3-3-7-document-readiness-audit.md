# V3-3..V3-7 剩余开发文档内部总审计

日期：2026-10-06。范围：V3-3 画面证据、V3-4 TaskStore/Outline、V3-5 产品/Human Review、V3-6 单 run、V3-7 最终审计。未运行这些阶段的产品实现或真实 Provider。

## 0. 决定

`DOCUMENT CANDIDATE READY FOR THIRD EXTERNAL RE-AUDIT / ALL IMPLEMENTATION NO-GO`。

文档自身 Fatal=0/Major=0/Minor=0。首轮三项合同问题已落盘；第二轮指出跨字段语义规则只存在于仓库测试、审计包无法执行。现已新增独立只读 `v3-3-7-semantic-verifier.py`，覆盖 5 份 Schema、6 个正例和 10 个语义负例，并补充 `TaskBinding.mediaDurationMs` 拒绝越界 seek。前序和实施依赖 Major 继续保留，不因本审计关闭。

## 1. 交付完整性

| 阶段 | 开发顺序 | 验收分母 | 威胁/预审 | 机器合同 | 当前决定 |
|---|---|---|---|---|---|
| V3-3 | `-0..-7` | A01..A16 | 已落盘 | vision evidence v1 | NO-GO，前序/Provider/RapidOCR |
| V3-4 | `-0..-7` | V401..V418 | 已落盘 | outline taskstore v1 | NO-GO，V3-3/外审 |
| V3-5 | `-0..-7` | A01..A18 + H01..H10 | 已落盘 | product acceptance v1 + human review v1 | NO-GO，V3-4/外审/真实截图页 |
| V3-6 | `-0..-7` | A01..A20 + 12 页 | 已落盘 | finalization v1 candidate | NO-GO，V3-5/tooling |
| V3-7 | 只读终审 | Fatal=0/Major=0 | 已落盘 | finalization v1 disposition | NO-GO，V3-6 candidate |

## 2. 机器复算

- 5 份新增 JSON Schema 均通过 Draft 2020-12 meta-validation。
- 两份 positive fixture 中的 vision、outline、product、human、candidate、disposition 共 6 个实例均通过对应 Schema。
- 定向 pipeline/product 合同与语义负例：43 passed。
- Runtime 全量回归：414 passed in 50.50s。
- `git diff --check`：PASS。
- V3 pipeline/product 定向合同：43 passed。
- `v3-3-7-semantic-verifier.py`：语法检查 PASS；必须在重建审计包后从包内再次实跑。
- ID 连续性：V3-3 A01..A16、V3-4 V401..V418、V3-5 A01..A18/H01..H10、V3-6 A01..A20 全部精确无缺号。

第一次全量 pytest 因从错误 import root 启动而产生 collection errors；以 `services/local-runtime` + `PYTHONPATH=.` 重跑通过。错误调用保留在审计说明中，不包装为首次成功。

## 3. PRD 与架构对账

- 首版仍只针对 B站 12 页，不扩大到 YouTube、小红书或直播。
- 本地 SenseVoice、关键帧、本地 OCR、授权选定帧 VLM、VideoOutline、三视图、Ask、seek、历史和导出全部保留，无缩 scope。
- 人工验收仍只在 V3-5 且在自动 A01..A18 之后；V3-2..4 不要求人类补机器证据。
- V3 导出和 task history 不接入 V2/V4 知识服务；所有新合同把知识导入固定为 deferred。
- final candidate 必须 finalPassed=false；只有独立 disposition Fatal=0/Major=0 才允许 true 和精确限定声明。

## 4. 防假绿能力

机器负例覆盖：预算扩大、路径穿越、未选帧/撤销后上传、跨 task evidence、projection drift、revision replay、V4 状态提前开启、四视口缩减、seek 超差、人类项目缺失/automation reviewer、12 页缩减/重分类/重复、secret/residual 非零、候选提前 final=true、终审扩大声明。

Schema 与 fixture 均标为合同资产，不证明产品实现。现有 V3-0 umbrella fixture schema 保持历史只读；V3-5+ 使用最新 stage-specific schemas。

## 5. 继承阻塞

1. V3-2-2 有效 B站授权会话仍未恢复，后续没有合法生产输入。
2. V3-3 RapidOCR 精确资产和真实 VLM provider/model/credential/capability probe 未冻结。
3. V3-4 Outline Provider 仍需按实现时选择及独立授权。
4. V3-5 逐步截图验收页面必须由未来真实 build 生成。
5. V3-6 collector/verifier/package tooling 尚未实现或外审。

## 6. 外审问题闭环

- M-1（consent/dispatch）：Schema 增加逐 dispatch decision/sequence/valid receipt 与撤销后零 dispatch。
- M-2（seek/human）：Schema 增加 `deltaMs<=2000`、located identity 和 Human overall/judgment 条件。
- M-3（evidence closure）：transaction receipt 增加 unresolved/cross-task/projection closure `0/0/true`。

尚需外部复审确认上述三项关闭；本内部闭环不得替代独立意见。V3-3 的 10 个视觉成功样本、未来 Workspace route 和真实 build 仍在对应实施前门禁冻结，不属于可用 fixture 代替的文档缺口。

第二轮关键问题“Schema 接受的跨字段负例无法由审计包复算”通过独立 verifier 关闭。verifier 明确复算 consent dispatch 连续性、CAS、时间顺序、route/mode、seek 算术和媒体时长、Human 总判定、12 页 identity/classification/final 绑定；任何失败退出非零。

## 7. 结论

剩余 V3 文档已从“方向大纲”升级为可审查的实施候选，Schema 与跨字段语义均有包内机器复算入口。本轮内部审计完成时，第三轮独立复审、真实前序与 Provider/tooling 门禁仍未关闭；下一合法动作是完成第三轮外部复审，同时优先恢复 V3-2-2 有效授权会话。

第三轮独立复审随后完成并落盘到 `v3-3-7-independent-document-audit.md`：19/19 hash、5/5 Schema meta、6/6 positive、10/10 包内语义负例和 4/4 独立负例均通过；文档缺陷 Fatal=0/Major=0/Minor=2。两项 Minor 均为 fixture 占位标识，不阻断文档 PASS。V3-2、RapidOCR/VLM、真实 build/tooling 等实现前置仍保持 NO-GO，未被文档审查结论关闭。

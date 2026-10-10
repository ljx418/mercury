# V3-2-0 ASR 比较材料独立审查请求

日期：2026-09-18。请从平铺包 `AUDIT_MANIFEST.md` 开始，只读审查。

## 决策对象

用户已明确取消人工逐字听写，要求 Agent 生成不同 ASR 输出，由人类听原视频进行比较。候选实现使用冻结 small 生产模型和 base 独立基线，对 3 个固定真实 B站样本的 `00:30..02:30` 生成 24 个盲评 bin。

本次只请求判定：

```text
V3-2-0 comparison material and human review workflow: PASS / FAIL
Human quality gate D08: must remain PENDING
V3-2-1 implementation: must remain NO-GO
```

## 必查项

1. PRD、stage gate、V3-2 合同/开发/验收/威胁模型是否已移除当前 CER/人工听写门槛，且没有降低三样本、120 秒、双人独立和分歧复核分母。
2. `v3_asr_comparison_contracts.schema.json` 是否能同时表达 bundle、独立 review 和失败/通过 adjudication，不会让失败结果因 Schema 无法保存。
3. `v3_media_acquisition_sample_registry.schema.json` v2 是否要求每个 ASR 样本有 completed comparison window，并拒绝 pending/template 冒充 productionReady。
4. 机器材料是否真实绑定 3 样本、6 推理、24 bin、small/base exact revision/hash；是否存在动态挑窗、跨 run 拼接或 baseline 冒充 gold。
5. HTML 模板是否无逐字转写输入，能完成 review A/B、错误分类、不同 reviewer 校验、分歧复核和结果回填。
6. QA 自动结果是否只证明页面流程，未冒充真实人类判断。
7. 完整 transcript 留在私有 run 是否合理；公开包是否只含 hash/统计并保持 Cookie/路径秘密边界。
8. 当前正式状态是否严格保持 D08 pending、V3-2-0 NO-GO、V3-2-1 blocked。

## 已执行候选事实

- comparison bundle SHA-256：`868c2ca3e8be7032501c39e93b6be86be1333b28fb70ec5d45b9b0f17be7d8d0`。
- machine verifier：14/14 PASS。
- real Chrome：360/420/768/1280 PASS；Axe 0/0；Keyboard 3/3；review 与 adjudication JSON 生成 PASS。
- final secret scan：12 files / 422,266 bytes / 26 个 Cookie 原值 0 hit。
- QA reviewer/adjudicator 是自动流程测试，不计人类 D08。

## 允许的结论

最高只允许：`COMPARISON MATERIAL PASS / HUMAN COMPARISON REQUIRED`。不得声明 production ASR quality passed、revision 2 productionReady、V3-2-0 PASS、V3-2-1 GO 或完整 V3 ready。

审查结果请落盘到：

`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0-contract-dependency-samples/asr-comparison-independent-audit.md`

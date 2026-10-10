# V3-3 实施前审计

日期：2026-10-08。审计性质：内部文档、合同与前序门禁检查；未运行 V3-3 产品代码或云 VLM。

## 0. 决定

`DOCUMENT PASS / OCR AND SAMPLE FREEZE PASS / VLM AUTHORIZATION REQUIRED / IMPLEMENTATION NO-GO`。

Fatal=0，Major=1，Minor=0；前序 V3-2、RapidOCR 和样本派生门禁已关闭。

## 1. 已闭合项

- PRD §18.2、架构 §22、V3 总开发/验收计划对 V3-3 范围一致。
- 具体代码实体、依赖方向、24/12/8 预算、1280 px 上限和单帧上传边界已冻结。
- `contracts/v3_media_vision_evidence_v1.schema.json` 已定义 frame/OCR/VLM/consent/cleanup 机器结构，并强制逐 dispatch consent decision/sequence、有效性回执和撤销后零 dispatch。
- `fixtures/v3-media-vision-outline-positive.json` 提供正向结构样本，不作为生产事实。
- `test_v3_media_pipeline_contracts.py` 已覆盖 Schema meta、正例和无授权/撤销后 dispatch/预算/路径/跨 task 负例。
- A01..A16 包含用户场景、操作、必须结果和出门门槛；人工内容判断只在 V3-5。
- V3-2 生产 run `v3-2-production-20261007T174158Z` 已通过不同 session 独立审查，结论 `V3-2 LIMITED PASS`、Fatal=0/Major=0/Minor=0；该 run 是 V3-3 样本派生的唯一前序输入。
- `v3-3-dependency-freeze/v3-3-vision-sample-registry.json` 已从该 sealed run 机械派生 10 个成功样本，分类精确为 `6 subtitle + 3 asr + 1 multipart`，前 8 个按源顺序固定为云 VLM 目标。
- `rapidocr==3.9.2 + onnxruntime==1.28.0 + opencv-python==5.0.0.93` 及三份 wheel 内 ONNX 模型已冻结 bytes/SHA-256/许可；断网审计钩子下对 sealed 真实截图识别 82 条、网络尝试 0、GPU=false、峰值 RSS 426072 KiB。

## 2. Major

### M-2 VLM Provider 未冻结

仓库中没有可作为生产权威的 providerId/modelId/API base/凭据注入/capability probe。positive fixture 的 `provider-frozen-at-v3-3` 明确是文档占位值，不得进入产品实现或验收。

2026-10-08 已增加 `services/local-runtime/scripts/v3_vision_capability_probe.py` 及 4 项离线测试。该 verifier 固定候选 provider/model、生成不含用户内容的中性 PNG、构造 `store=false`/无 tools 的 Responses 请求，并校验 exact model、Structured Output 与 usage；未同时提供 `--execute-neutral-probe` 和环境凭据时不会联网。当前 dry-run 为 `executed=false / passed=false / VISION_CAPABILITY_PROBE_NOT_EXECUTED`，因此只关闭“缺少可复现 probe 工具”，不关闭本 Major。

### 已关闭 M-3 RapidOCR 资产冻结

证据位于 `v3-3-dependency-freeze/`：引擎、wheel、模型、许可和真实离线 self-test 均已落盘。旧 `rapidocr-onnxruntime==1.4.4` 因官方退役且 PyPI yanked 未被冻结为产品依赖。

### 已关闭 M-4 样本派生

10 个应成功视觉样本已由 `v3-vision-dependency-freeze.py` 从 V3-2 sealed registry 派生，源 registry 与每张截图 hash 均重算匹配。

## 4. 防假绿结论

Schema 和 fixture 只能证明合同可表达，不能证明 FFmpeg、RapidOCR、云 VLM 或用户体验已经实现。任何将 24 个合同测试、静态 HTML、BiliNote 输出或 provider mock 报为 V3-3 PASS 的行为均为 Major。

## 5. 恢复条件

1. ~~V3-2 LIMITED/PASS 出门候选可用。~~ 已关闭。
2. ~~RapidOCR manifest 和真实离线 probe 落盘。~~ 已关闭。
3. 使用 `v3_vision_capability_probe.py --execute-neutral-probe` 完成中性图真实 capability probe，且用户批准高风险选定帧上传边界；dry-run 不计通过。
4. 清空重建不超过 20 文件的外部文档审计包，独立审查 Fatal=0/Major=0。
5. 用户明确批准 `V3-3 implementation`。

满足前述条件前，只允许继续文档、Schema、fixture 和不触及真实 Provider 的 verifier 工作。

# V3-3 关键帧、OCR 与授权 VLM 开发计划

日期：2026-10-08。状态：`DOCUMENT PASS / OCR AND SAMPLE FREEZE PASS / VLM CAPABILITY + AUTHORIZATION REQUIRED / IMPLEMENTATION NO-GO`。

## 1. 阶段目标与用户结果

V3-3 把 V3-2 已通过的同一 `MediaTask` 当前分 P 媒体和 `MediaTranscript` 转换为可审计的画面证据。用户最终能在 V3-5 看见与时间点绑定的证据缩略图、OCR 文本和经授权产生的画面说明；本阶段不实现最终大纲、Mindmap、Ask、播放器反跳或人工验收。

阶段成功只允许声明：冻结样本上的关键帧、本地 OCR 和授权 VLM 证据管线通过。不得声明视频已完整理解，也不得用字幕、标题、简介或常识填补缺失画面证据。

## 2. 输入与前置门禁

实施前必须同时满足：

1. V3-2-7 已以单一 sealed run 通过，当前 `taskId/sourceIdentity/currentPart` 的媒体、Transcript 和清理回执可复算。
2. V3-3 外部文档审查 Fatal=0/Major=0。
3. RapidOCR engine、model revision、资产 SHA-256、许可和离线加载方式已冻结。
4. 至少一个真实 `MediaVisionProvider` 的 providerId、modelId、API base、请求格式、超时、重试、usage/cost 映射和凭据注入方式已冻结并通过最小 capability probe。
5. 用户已明确授权 `selected_frame_cloud_vision` 高风险实施边界；授权不等同于默认上传。
6. 不从 V3-2 失败 run、BiliNote 输出、fixture 或静态原型读取生产事实。

## 3. 代码实体与所有权

| 实体 | 目标位置 | 职责 | 禁止 |
|---|---|---|---|
| `MediaFramePipeline` | `services/local-runtime/navia_runtime/modules/media_companion/vision/` | 校验任务媒体、调用抽帧器、执行确定性预算、生成候选和选定帧 | 不调用门户 DOM、Cookie、UI 或云 API |
| `FrameExtractor` | 同目录 `frame_extractor.py` | 受控 FFmpeg/OpenCV 子进程、时间点抽帧、缩放和 hash | 不上传、不总结、不持久化绝对路径 |
| `FrameSelectionPolicy` | 同目录 `sampling.py` | scene-change + timeline budget，输出选择原因 | 不读取字幕内容来伪造画面事实 |
| `LocalOcrAdapter` | 同目录 `ocr.py` | RapidOCR 本地推理，输出 bbox/text/confidence | 不联网、不把 OCR 文本标为 VLM caption |
| `MediaVisionProvider` | `modules/adapters/media_vision.py` | vendor-neutral capability 接口，单帧受治理请求 | 不接收原视频、Cookie、task root 或未选定帧 |
| `GovernedMediaVisionAdapter` | D Adapter Layer | 授权复查、预算、撤销屏障、超时、usage/trace | 不记录 API key 或原始私有帧到公开日志 |
| `FrameEvidenceRepository` | Runtime task artifact 层 | 保存证据帧和分型观察，终态删除非证据帧 | 不跨 task 引用、不绕过清理 barrier |
| `VisionEvidenceValidator` | `vision/validator.py` | 校验 identity、时间、授权、证据闭合和清理回执 | 不补写缺失 observation |

## 4. 冻结采样与资源预算

机器合同为 `contracts/v3_media_vision_evidence_v1.schema.json`：

- 每 task 最多生成 24 个候选帧。
- 最多保留 12 个证据帧。
- 最多向云端 VLM 发送 8 个已选证据帧。
- 帧最长边不超过 1280 px；不上传原视频或连续帧序列。
- 抽帧时间必须位于当前分 P 媒体时长内，按毫秒升序、同时间点去重。
- `frame`、`ocr_block`、`vision_caption`、`transcript` 是互不替代的证据类型。
- VLM 每次只接收一个已选帧及最小结构化任务提示；不得附带 Cookie、页面 HTML、绝对路径或未授权 transcript 全文。
- 非证据帧在 `succeeded/failed/cancelled` 三种终态均删除；证据帧只保留到任务删除或导出清理。

## 5. 子阶段

### V3-3-0 合同与依赖冻结

- 冻结 Schema、positive fixture、FailureCode、RapidOCR manifest、VLM provider manifest。
- 对 FFmpeg/OpenCV/RapidOCR/VLM SDK 做许可、版本、hash 和网络面审计。
- capability probe 只验证最小真实帧请求，不计生产 8/10 分母。

出门：Schema meta PASS；负例全部 fail closed；外审确认 provider 不是占位字符串。

### V3-3-1 任务媒体绑定与抽帧器

- 只接受 V3-2 当前 `taskId/sourceIdentity/currentPart` 的只读媒体引用。
- 子进程 argv 禁止 shell 拼接；输入输出必须位于 task sandbox。
- 输出 timestamp、尺寸、artifact hash 和选择前候选记录。

出门：路径穿越、跨 task、时长外时间点、进程超时和损坏媒体均产生唯一失败终态。

### V3-3-2 确定性采样

- 实现 scene-change + timeline budget。
- 相同输入 bytes、策略版本和工具版本必须产生相同时间点集合。
- 24/12/8 三层预算不可由 Provider 或 UI 扩大。

出门：重复运行 hash 相同；0 overlap/duplicate；预算越界被 validator 拒绝。

### V3-3-3 本地 OCR

- 固定 RapidOCR 引擎与模型资产；启动时校验 hash。
- 对全部选定证据帧运行本地 OCR，保留归一化 bbox、原始识别文本和 confidence。
- OCR 空结果是合法观察，但不得被写成“画面无文字”的确定性语义。

出门：冻结 10 个应成功样本 10/10 完成本地 OCR pipeline；网络阻断下仍可运行。

### V3-3-4 授权 VLM

- 每次请求前读取持久 consent 当前状态并获得 outbound barrier permit。
- `ConsentReceipt` 记录 `authorizedDispatchCount`、固定为 0 的 `postRevocationDispatchCount` 和 `consentCheckedPerDispatch=true`；每个 `VisionObservation` 绑定同一 `consentDecisionId`、连续 `dispatchSequence` 与 `consentValidAtDispatch=true`。
- 仅上传 `selected=true` 的证据帧；请求/响应分别 canonical hash。
- 显式记录 provider/model、上传时间、input bytes、token/费用或 `null`。
- 429、5xx、timeout、invalid response、撤销竞争不得切换未冻结 Provider。

出门：冻结 10 个应成功样本中至少 8 个完成真实 VLM；授权前和撤销屏障后新上传数为 0。

### V3-3-5 证据合并与清理

- 建立 `frame -> OCR/VLM` 引用关系，不改写 transcript。
- 清理候选帧、Provider 临时 body、子进程文件和内存队列。
- 生成公开回执时移除原始私有图像、绝对路径、token/API key。

出门：三个终态 residual non-evidence frame=0、pending outbound=0。

### V3-3-6 真实矩阵与产品回归

- 对 Revision 3 中 10 个应成功页面运行真实抽帧/OCR；至少 8 个运行真实授权 VLM。
- 保存 private 证据帧和 public hash/index；禁止跨 run 拼接。
- 运行 Runtime、Extension、V3-1/V3-2 回归；四视口只验证证据预览壳，不做人工内容判断。

### V3-3-7 独立出门审计

- 清空并重建不超过 20 文件的平铺审计包。
- 独立复算固定分母、逐 dispatch 授权绑定、撤销后零 dispatch、provider/model/hash/usage、清理和秘密扫描。
- Fatal=0/Major=0 才可进入 V3-4 文档最终冻结。

## 6. FailureCode 闭集

`MEDIA_BINDING_INVALID`、`FRAME_EXTRACTOR_UNAVAILABLE`、`FRAME_EXTRACTION_FAILED`、`FRAME_TIME_OUT_OF_RANGE`、`FRAME_BUDGET_EXCEEDED`、`OCR_ASSET_INVALID`、`OCR_FAILED`、`VISION_CONSENT_REQUIRED`、`VISION_CONSENT_REVOKED`、`VISION_PROVIDER_UNAVAILABLE`、`VISION_RATE_LIMITED`、`VISION_TIMEOUT`、`VISION_RESPONSE_INVALID`、`VISION_BUDGET_EXCEEDED`、`EVIDENCE_IDENTITY_MISMATCH`、`VISION_CLEANUP_FAILED`、`CANCELLED`。

未识别错误不得映射为成功、degraded 或其他 Provider 自动成功。

## 7. 交付物

- 生产代码与单元/合同/E2E 测试。
- RapidOCR 与 VLM provider manifests。
- Schema-valid `VisionEvidenceReceipt`、真实 private artifacts、public index、cleanup receipt。
- 每子阶段开发卡、验收结果、PRD review、false-green audit。
- V3-3 独立实施出门审查。

## 8. 当前停止条件

V3-2 前置、RapidOCR 精确资产、10 个视觉样本与 capability verifier 外部审查均已关闭。当前仅缺真实 VLM provider/model/credential capability probe，以及用户对真实选定帧上传边界的明确高风险授权；两者同时关闭前，V3-3 产品代码实施保持 NO-GO。未执行 probe 必须 `passed=false` 且进程返回非零，禁止仅凭脚本可运行或报告可生成关闭门禁。

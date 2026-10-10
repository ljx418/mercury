# V3-3 关键帧、OCR 与授权 VLM 威胁模型

日期：2026-10-08。状态：`DOCUMENT PASS / OCR AND SAMPLE FREEZE PASS / VLM AUTHORIZATION REQUIRED`。

## 1. 资产与信任边界

私有资产包括任务期媒体、候选帧、证据帧、OCR 文本、VLM 请求、API 凭据、provider 原始响应和用户 consent。Extension 只显示脱敏任务状态；抽帧/OCR 位于本地 Runtime；只有 D Adapter/Governance 可跨越云端边界。

## 2. 主要威胁与控制

| ID | 威胁 | 控制 | 验证 |
|---|---|---|---|
| T01 | 路径穿越读取任意本地文件 | task-relative ref、realpath containment、拒绝 symlink escape | A04 negative |
| T02 | FFmpeg/OpenCV 参数注入 | argv 数组、无 shell、冻结 codec/format、资源限制 | static audit + fault test |
| T03 | 恶意视频造成资源耗尽 | 24 帧、1280 px、CPU/内存/超时限制、取消 | budget/fault receipts |
| T04 | 无授权上传私有画面 | scope 精确匹配、每请求复查、outbound permit | A07/A09 |
| T05 | 撤销竞争仍产生新请求 | durable barrier、in-flight ledger、barrier 后 deny | revoke timeline |
| T06 | Provider 获得原视频或多余上下文 | 单选定帧、最小提示、rawVideoUploadAllowed=false | request manifest |
| T07 | API key/Cookie/路径泄漏 | 进程内 credential、日志 redact、public scan | A14 |
| T08 | Provider 响应注入虚假事实 | typed response、evidence link、validator、不直接渲染 HTML | contract negatives |
| T09 | OCR 被误标为视觉 caption | closed evidence kind、独立字段和 renderer label | A10 |
| T10 | transcript 伪装为画面证据 | vision conclusion 必须引用 frame/vision evidence | A11 |
| T11 | 跨 task 或旧 run 证据复用 | taskId/sourceIdentity/hash closure、single-run manifest | A01/A16 |
| T12 | 临时帧残留 | terminal cleanup barrier、startup orphan sweep | A13 |
| T13 | 未冻结 Provider 静默切换 | build-time manifest、providerId/modelId exact match | A08/A12 |
| T14 | 费用或用量假绿 | 真实 usage；未知为 null；请求数与 ledger 一致 | A08 |
| T15 | 公开证据包含私有图像 | public/private index 分离，tar member allowlist | A14 |

## 3. 凭据和授权生命周期

VLM credential 由 Runtime 配置/安全存储注入 Provider host，不进入 UI、task aggregate、EventStore 或审计包。Consent 是持久决策，但每次 outbound 都必须重新读取当前状态。每个 observation 绑定 consent decision、dispatch sequence 和 dispatch-time valid receipt；聚合回执记录授权 dispatch 总数及撤销后 dispatch 数。撤销先写 durable barrier，再拒绝新 permit；已送达 Provider 的请求无法撤回，UI 和证据必须诚实显示该范围。

## 4. Provider 故障策略

不进行未冻结 Provider 的自动 failover。429、超时和 5xx 只在同一 provider/model 内按冻结次数重试；超过预算后输出 degraded/failure。无 VLM 时允许保留本地 OCR/frame 证据，但不得把其标为 VLM 通过。

## 5. 删除与恢复

任务终态删除所有 `delete_at_terminal` 帧；任务删除再删除证据帧和 OCR/VLM 派生物。Runtime 重启只恢复已提交 evidence metadata，不重放已成功的云端请求；状态不确定的 outbound 进入人工可见失败，不自动补发。

## 6. 当前未关闭风险

- `R-VISION-01`：真实 VLM provider/model/credential 和数据处理边界未冻结，Major。
- `R-VISION-02`：已关闭。RapidOCR 3.9.2、ONNX Runtime 1.28.0、OpenCV 5.0.0.93、三份模型资产、许可、wheel/model hash 和断网 probe 已冻结。
- `R-VISION-03`：已关闭。V3-2 唯一生产 run 已取得独立 `LIMITED PASS`，10 个视觉样本从其 sealed registry 机械派生。

`R-VISION-01` 关闭且用户明确授权真实选定帧上传前，不得实施 V3-3。Capability verifier 的 dry-run、离线测试或中性图构造均不能替代真实 probe。

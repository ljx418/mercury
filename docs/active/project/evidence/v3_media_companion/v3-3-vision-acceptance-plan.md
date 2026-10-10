# V3-3 关键帧、OCR 与授权 VLM 验收计划

日期：2026-10-06。状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`。

## 1. 固定分母

V3-3 固定 `V3-3-A01..A16`，不得 N/A、缩小样本、跨 run 或用 fixture/mock/BiliNote 输出计生产通过。

| ID | 用户场景与操作 | 必须结果 | 主要证据 |
|---|---|---|---|
| A01 | 从已通过的 V3-2 task 开始画面分析 | task/source/currentPart/media hash 全相同 | 输入 manifest、binding receipt |
| A02 | 对同一媒体重复运行采样 | 时间点有序去重且确定性 hash 相同 | sampling receipt、两次 diff |
| A03 | 正常抽取候选帧 | 候选 <=24、证据 <=12、云端 <=8、最长边 <=1280 | Schema-valid receipt |
| A04 | 篡改路径、task 或时间点 | 全部 fail closed，不读取 sandbox 外文件 | negative results |
| A05 | 10 个应成功页面运行 OCR | 10/10 完成真实本地 pipeline，engine/model/hash 完整 | OCR observations、asset manifest |
| A06 | 网络完全阻断时运行 OCR | OCR 仍可运行，outbound=0 | network deny log、result hash |
| A07 | 未授权点击画面分析 | 本地抽帧/OCR可按范围执行，云端上传=0，UI 显示需授权 | consent/trace/UI screenshot |
| A08 | 授权 `selected_frame_cloud_vision` 后运行 | 至少 8/10 页面有真实 VLM 成功观察；每个 dispatch 绑定当前 consent decision/sequence 且 `consentValidAtDispatch=true` | provider receipt、request/response hash、dispatch ledger |
| A09 | VLM 执行中撤销 | `postRevocationDispatchCount=0`；barrier 后新请求=0；在途范围明确；终态不伪成功 | revoke timeline、outbound ledger、Schema receipt |
| A10 | 检查证据类型 | frame/OCR/VLM/transcript 分型且引用闭合 | evidence registry |
| A11 | 问题只被字幕支持、无画面证据 | 不生成视觉结论，标记 degraded/insufficient visual evidence | validator negative |
| A12 | 429/5xx/timeout/invalid response | 唯一失败终态，不静默换 Provider，不复制旧 caption | fault matrix |
| A13 | 成功、失败、取消三终态 | non-evidence residual=0、pending outbound=0 | cleanup receipts |
| A14 | 扫描 public package | 0 Cookie/token/API key/绝对路径/原始私有帧 | secret/path/tar scan |
| A15 | 360/420/768/1280 查看证据预览壳 | 无根溢出；Axe serious/critical=0；键盘可达 | Chrome screenshots、Axe、keyboard |
| A16 | 完整回归和独立复算 | Runtime/Extension/V3-1/V3-2 通过；独立审计 Fatal=0/Major=0 | logs、manifest、independent audit |

## 2. 真实样本

- 样本来自同一个 V3-2-7 sealed 12 页 run。
- 10 个“应成功”页面必须覆盖字幕、ASR、多 P 和低信号类别中仍具有可见画面的页面。
- restricted/blocked 页面不能被偷偷移出总矩阵；它们进入故障分母，但不计 10 个应成功 OCR/VLM 分母。
- 具体 URL、bvid/cid/part、expected class 和输入媒体 hash 在 V3-3 实施前 registry 中冻结。

## 3. 机器一致性校验

除 JSON Schema 外，verifier 必须验证：

1. 所有 frame/OCR/VLM observation 的 taskId 相同。
2. OCR/VLM 引用的 frame 存在，VLM frame 必须 `selected=true`。
3. VLM 上传发生于 grant 后且不晚于 revoke barrier。
4. 候选、保留、删除计数与实际 artifact index 精确相等。
5. request/response hash、provider/model、usage/cost 字段不可缺失；未知 cost 为 `null`，不能写 0。
6. success observation 不允许 failureCode；失败不得产生成功 caption。
7. public index 只包含 hash、相对引用和脱敏元数据。

## 4. PRD 规格检视

每个子阶段结束后对照 PRD §18.2、架构 §22 和 ADR-V3-04，确认：

- 没有把全量视频上传改成默认路线。
- 没有把云 VLM 改为无授权或隐式授权。
- 没有把 OCR、字幕或标题改名为画面理解。
- 没有提前实现 V3-4 大纲或 V3-5 Ask/H 项。
- 没有扩大到 YouTube、小红书、直播或 V4 知识导入。

## 5. 出门决定

以下任一项为 Major/Fatal：真实 provider 未冻结却使用占位响应；10/10 OCR 或 8/10 VLM 分母不足；缺少逐 dispatch consent 绑定；授权前/撤销后上传；原视频上传；跨 task/跨 run 引用；无视觉证据却产生视觉结论；非证据帧残留；秘密进入公开包。

全部 A01..A16 PASS 且独立审计 Fatal=0/Major=0 后，V3-3 才能取得限定 PASS。人工视觉内容判断推迟到 V3-5 H01..H10。

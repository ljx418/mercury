# V3-3-0 视觉依赖冻结开发及验收计划

日期：2026-10-08。状态：`IN PROGRESS / PRODUCT IMPLEMENTATION NO-GO`。

## 1. 目标与继承

本子阶段只关闭 V3-3 实施前的依赖与输入门禁，不实现关键帧、OCR 产品服务或云 VLM。唯一前序输入是已取得独立 `V3-2 LIMITED PASS` 的 `v3-2-production-20261007T174158Z`；不得从旧 run 拼接样本。既有 V3-3 `-0..-7`、A01..A16、24/12/8/1280 预算和 V3 总计划保持不变。

## 2. 开发步骤

1. 从 V3-2 sealed registry 机械派生全部 10 个 `expectedOutcome=success` 页面；前 8 个按源顺序成为云 VLM 固定目标，后 2 个只进入 frame/OCR 分母。
2. 使用官方统一包 `rapidocr==3.9.2`，拒绝冻结已退役且被撤回的 `rapidocr-onnxruntime==1.4.4`。
3. 冻结 RapidOCR、ONNX Runtime、OpenCV 的版本、许可、wheel SHA-256，以及三份 wheel 内模型的 bytes/SHA-256。
4. 在 Python audit hook 拒绝 `socket.connect`/`socket.getaddrinfo` 的条件下，对 V3-2 sealed 真实截图执行 OCR 自检；保留计数、置信度、结果 hash、耗时和峰值 RSS，不复制 OCR 全文。
5. 只读探测现有 VLM 配置能力；没有真实 provider/model/credential 时保持 M-2，不得用 mock 或 fixture 关闭。

## 3. 固定验收

| ID | 操作 | 必须结果 |
|---|---|---|
| DF01 | 重算 V3-2 source registry | SHA-256 与 sealed run 一致 |
| DF02 | 派生成功样本 | 精确 10 个，`6 subtitle + 3 asr + 1 multipart` |
| DF03 | 选择云目标 | 精确 8 个且由确定性规则产生 |
| DF04 | 校验 Python packages | RapidOCR 3.9.2、ONNX Runtime 1.28.0、OpenCV 5.0.0.93 |
| DF05 | 校验模型 | 三份模型 bytes/hash 精确匹配 manifest |
| DF06 | 断网 OCR | 真实 sealed 截图输出非空，网络尝试 0，GPU=false |
| DF07 | 低资源检查 | 线程不超过 4，峰值 RSS 小于 1 GiB |
| DF08 | 防假绿 | 不把页面截图 OCR 扩大为视频关键帧/OCR/VLM 已实现 |
| DF09 | VLM 能力 | 只有真实 provider/model/credential capability probe 才能关闭 M-2 |
| DF10 | 高风险边界 | 未获用户明确授权前，选定帧上传数必须为 0 |

## 4. 出门条件

DF01..DF08 全部通过只关闭 RapidOCR 与 10 样本前置；DF09 和 DF10 未关闭时，V3-3 产品实现继续 `NO-GO`。不得声明 V3-3、OCR 生产链或云视觉通过。

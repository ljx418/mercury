# V3-3-0 依赖冻结独立文档审查请求

日期：2026-10-08。审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`。

## 1. 审查范围

本轮只审查 V3-3-0 的前序、OCR 依赖、10 样本派生、VLM Provider 候选与授权边界。不执行产品 OCR/VLM，不读取或请求 API key，不上传任何图像，不批准 V3-3 实施。

## 2. 候选自报

- V3-2 唯一前序 run 已取得独立 `LIMITED PASS`，Fatal=0/Major=0/Minor=0。
- RapidOCR 3.9.2 / ONNX Runtime 1.28.0 / OpenCV 5.0.0.93 的 wheel、许可、三份 ONNX 资产 bytes/hash 已冻结。
- sealed 真实截图离线 probe：82 条、网络尝试 0、GPU=false、peak RSS 426072 KiB。
- 10 个成功视觉样本从 V3-2 registry 机械派生；`6 subtitle + 3 asr + 1 multipart`；前 8 个是固定云目标。
- 推荐候选为 OpenAI Responses + `gpt-4.1-mini-2025-04-14`，但没有真实凭据 probe，也没有用户选定帧上传授权。
- 内部决定：`OCR AND SAMPLE FREEZE PASS / VLM AUTHORIZATION REQUIRED / V3-3 IMPLEMENTATION NO-GO`，Fatal=0/Major=1/Minor=0。

## 3. 必须独立复算

1. `AUDIT_MANIFEST.md` 的 19 项 payload SHA-256，以及包副本与 manifest 内声明权威路径的字节一致性。
2. V3-2 出门审计是否真的允许 V3-3 进入实施前门禁，且没有被扩大为 V3-3 PASS。
3. 独立从 source registry 派生 10 个 success，校验 `6+3+1`、8 cloud targets、URL/part/playbackUnitId 和每张 source screenshot hash。
4. 独立重算 manifest/sample registry canonical content hash 和三份 ONNX 资产 hash。
5. 检查 probe 是否真正拒绝 Python socket connect/getaddrinfo，是否只用 sealed 真实截图，是否存在结果补写或资源假绿。
6. 核对旧 yanked/retiring package 被拒绝、新官方统一包被冻结的技术合理性和跨平台风险。
7. 审查 VLM 候选的厂商中立接口、8 帧/1280 px/`store=false`/无 tools 边界、成本估算和默认最多 30 天滥用监测留存告知是否足以支撑用户决策。
8. 判断除已知 VLM 真实凭据 probe/用户授权外，是否还有任何 Fatal/Major。

## 4. 禁止扩大

- 不得将 OCR dependency probe 报为关键帧抽取、10/10 生产 OCR 或 VLM 已实现。
- 不得将 Provider 候选文档报为真实 capability probe。
- 不得使用 DeepSeek 文本 Provider、fixture、mock、页面截图 OCR 或 Agent 自身视觉代替产品 VLM。
- 不得修改主工作树，不得运行云端请求。

## 5. 输出

请将审查报告写入：

`docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze/independent-document-audit.md`

报告必须列出 Fatal/Major/Minor，并给出以下两个独立决定：

1. `OCR AND SAMPLE FREEZE PASS` 是否成立。
2. V3-3 是否仍必须等待 VLM 真实 capability probe 和用户高风险授权。

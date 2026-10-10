# V3-3-3 本地 OCR 验收计划

日期：2026-10-08。

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 核对包与三份模型资产 | version/bytes/SHA-256 全匹配 |
| A02 | 对 task-owned 真实帧运行 OCR | typed observation；provider=`rapidocr_local`；localOnly=true |
| A03 | 检查 blocks | 文本非空、confidence 0..1、bbox 归一化且有序 |
| A04 | 重复同帧 | contentSha256 相同 |
| A05 | 无文字帧 | blocks 可为空，不产生“无文字”语义 caption |
| A06 | 禁网运行 | 网络调用 0，OCR 仍完成 |
| A07 | 跨 task/资产 hash 漂移/损坏帧 | 唯一 `OCR_ASSET_INVALID` 或 `OCR_FAILED` |
| A08 | 检查公开 DTO | 无绝对路径、图像原始字节、Cookie、API Key |
| A09 | 真实矩阵阶段 | V3-3-6 必须对 10 个应成功样本重新执行 10/10，不复用本阶段计数 |

# V3-3-3 本地 OCR 实施出门审计

日期：2026-10-08。

结论：`V3-3-3 LIMITED PASS`。Fatal=0，Major=0，Minor=1。

## 实现审计

- 新增 `LocalOcrAdapter`，仅接受当前 `TaskArtifactSandbox` 所有的 `frame` ArtifactRef。
- 初始化精确检查 3 个 distribution 版本、三份模型资产 byte/hash；漂移统一 fail-closed 为 `OCR_ASSET_INVALID`。
- ONNX Runtime 固定 CPU、intra-op 4 线程、inter-op 1 线程；OCR 不调用 Provider。
- 输出闭集为 `provider=rapidocr_local`、`engineVersion=3.9.2`、`localOnly=true`、归一化 bbox、原文、confidence 与 canonical hash。
- 空 blocks 是合法观察；实现不生成“画面无文字”caption。
- 越界、NaN、退化框、空文本、非法 confidence、损坏图片或引擎异常均 fail-closed。
- 公开 DTO 不含绝对路径、图片字节、Cookie、API Key。

## 真实验收

- 锚点：`BV1ZpYd66ELP` 当前 P，重新下载独立 8 秒真实视频，不复用旧媒体。
- 0ms/4000ms/7500ms 三个真实帧均完成本地 OCR，共 10 个 block。
- 文本均非空，confidence/bbox 全合法；同帧重复运行 contentSha256 3/3 一致。
- OCR 执行期间 socket connect 调用 0；Cookie、媒体、task root 均清理。
- 去敏机器证据：`v3-3-dependency-freeze/v3-3-3-real-bilibili-ocr-result.json`。

## 自动验收

- OCR/帧/采样定向回归：12 passed。
- 冻结 RapidOCR 真实离线引擎测试包含在回归中。
- Runtime 全量回归：603 passed（70.96s）；唯一 warning 为既有 Starlette/httpx deprecation。

Minor M-1：本阶段是单样本实现门禁，不替代 V3-3-6 同一生产 run 的 10/10 OCR 固定分母。

允许进入 V3-3-4 详细计划、验收与实施前审计；不得将本结论扩大为 V3-3、VLM 或产品 PASS。

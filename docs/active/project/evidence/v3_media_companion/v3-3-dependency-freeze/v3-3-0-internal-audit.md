# V3-3-0 依赖冻结内部审计

日期：2026-10-08。范围：V3-2 前置、10 样本派生、RapidOCR 资产与离线自检、VLM 候选。

## 0. 决定

`OCR AND SAMPLE FREEZE PASS / VLM AUTHORIZATION REQUIRED / V3-3 IMPLEMENTATION NO-GO`。

Fatal=0，Major=1，Minor=0。唯一 Major 是真实 VLM provider/model/credential capability probe 和用户选定帧上传授权未完成。

## 1. 独立复核结果

| 项 | 结果 |
|---|---|
| V3-2 前置 | `v3-2-production-20261007T174158Z` 独立审计 Fatal=0/Major=0/Minor=0 |
| source registry | sealed `sample-registry-v5.json` SHA-256 绑定 |
| 样本分母 | 10 个；`6 subtitle + 3 asr + 1 multipart` |
| 云目标 | 前 8 个按 source order 机械选择；精确 8 |
| RapidOCR | 3.9.2，Apache-2.0，wheel hash 固定 |
| ONNX Runtime | 1.28.0，MIT，Linux CPython 3.12 wheel hash 固定 |
| OpenCV | 5.0.0.93，Apache-2.0，Linux wheel hash 固定 |
| ONNX assets | det/rec/cls 三份 bytes 与 SHA-256 全部匹配 |
| 真实离线 probe | sealed 截图，82 条，mean confidence 0.973910，网络尝试 0 |
| 资源 | CPU 4 threads，GPU=false，peak RSS 426072 KiB < 1 GiB |
| canonical hash | manifest `3cff6d58...d81f`；samples `04a948a7...afb2`，独立重算一致 |

## 2. 风险处置

- 拒绝将本机已安装的旧 `rapidocr-onnxruntime 1.4.4` 冻结为产品依赖：官方已标注逐步退役，PyPI 1.4.4 已 yanked。
- 新统一包 3.9.2 在隔离 target 目录安装，没有污染或借用临时包作为仓库产物；产品依赖已精确写入 `requirements.txt`。
- OCR 自检使用页面截图，只证明引擎/资产/断网/资源门禁；不证明视频抽帧、10/10 产品 OCR 或 VLM。
- 项目现有 DeepSeek Chat Provider 不具备已冻结的图像输入合同，不得复用文本 test 伪装 VLM probe。

## 3. 未关闭 Major

`V3-3-M2`：用户需要明确批准 `selected_frame_cloud_vision` 边界，并为冻结的视觉 Provider 配置可用凭据。授权前只允许使用中性合成图的 capability probe 文档/代码准备，真实 B站帧上传必须为 0。

## 4. 下一门禁

1. 用户确认 provider 候选、默认最多 30 天滥用监测留存风险和 8 张选定帧上传授权。
2. 使用非用户内容合成图执行真实 capability probe，落盘 provider/model/response/usage hash，公开材料 secret scan=0。
3. 重建 <=20 文件平铺外审包，独立文档审查 Fatal=0/Major=0。
4. 只有上述条件闭合后才能进入 V3-3-1..7 产品实施。

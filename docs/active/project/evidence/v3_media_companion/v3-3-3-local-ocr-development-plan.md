# V3-3-3 本地 OCR 开发计划

日期：2026-10-08。前置：V3-3-2 LIMITED PASS。

## 目标

对 selected frame 在本机离线执行冻结的 RapidOCR CPU pipeline，输出归一化 bbox、原始文本、confidence 与 canonical hash。空 blocks 是合法观察，但不等于“画面没有文字”。

## 顺序

1. 安装并核对 `rapidocr==3.9.2`、`onnxruntime==1.28.0`、`opencv-python==5.0.0.93`。
2. 逐字节核对三份 wheel 内 ONNX 资产与冻结 manifest。
3. 实现 `LocalOcrAdapter`，只接受 task-owned frame artifact，初始化时 fail closed 校验依赖。
4. 归一化四点 bbox 为 `[x1,y1,x2,y2]` 0..1；拒绝 NaN、越界、空文本和非法 confidence。
5. 在禁网钩子下对真实抽取帧运行；记录 engine/model/hash，不记录绝对路径。
6. 覆盖资产漂移、跨 task、损坏图片、引擎异常与空观察。
7. 执行回归、PRD 检视和出门审计。

本阶段的单样本实现验收不替代 V3-3-6 的 10/10 生产 OCR 分母。

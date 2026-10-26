# WP0 R7 PRD 覆盖审查

## 已支持

- B站页面身份、同源单任务仲裁和已有 SourceAuthority 约束。
- 公开/凭据字幕优先。
- 受控任务期媒体下载、本地 SenseVoice ASR、任务期临时文件治理。
- 现有关键帧、OCR、授权 VLM、Outline、时间线、导图、Ask、证据跳转和导出实现事实，仍受各自既有质量门禁约束。
- relay v11 已验证的 Background 单一 WebSocket owner、Offscreen producer、单信用背压、重启对账、durable handoff、失败清理和秘密边界。

## 受限支持

- `tabCapture`：代码和安全合同保留，但 owned Chrome 用户可达生命周期结果为 0/7，默认关闭，不能称为稳定 fallback。
- 自动输入全部失败：产品诚实显示 blocked，不再让用户误以为正在后台录音或持续分析。
- WP0 closeout：只证明输入链候选和 capture 限制被正确封存，不替代 V3 的内容质量、六视频、人工体验或总出门门禁。

## 未实现

- 用户显式选择本地视频并接续同一分析任务。
- 本地导入的上传/本机路径协议、大小与磁盘治理、取消、断点、损坏恢复和 SourceAuthority 冲突处理。
- `tabCapture` 跨两个受支持 Chrome 版本的完整正控资格。
- V3-5.10 B-5 六视频质量分母、Stage C/D/E、正式 H01..H10 和整个 V3 closeout。

## 体验判断

当前受限体验优于静默进入 capture：失败原因可见、不会产生额外权限动作、不会出现长时间无反馈的实时录音等待。代价是自动下载被平台拒绝时覆盖率下降。后续以“依赖就绪”降低自动下载失败率，再以用户显式单文件导入提供可恢复 fallback；只有上述两条仍无法覆盖关键场景时才重启 tabCapture 资格化。

结论：WP0/P0 范围满足 `LIMITED PASS`；整个 V3 不满足 PASS。

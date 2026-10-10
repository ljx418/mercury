# V3-5.1 浏览器验收基础设施失败记录

日期：2026-10-10  
目标 run：`v3-5.1-production-candidate-20261010T210000Z`

## 失败事实

- 隔离 Runtime 已成功启动，但 Node 就绪探针请求受保护的 `/v1/companion/status` 时收到预期的 `403`。
- runner 错把 `403` 判为 Runtime 未启动，在进入任何候选页面、播放器 seek 或 Axe 验收前超时退出。
- 未生成 `candidate-1..3.json` 或 `browser-verification-result.json`，不计入产品失败和通过分母。

## 修复与隔离

- 就绪探针改为：本机端口返回任意 HTTP 状态即证明 uvicorn 与 origin guard 已就绪；安全会话仍只能由精确扩展 Origin 建立。
- Chrome 临时 profile 与 Runtime 进程已清理；Cookie 值未输出、未落盘到公开证据。
- 后续必须从三个视频的第一个操作重新开始，不得复用本次尝试的交互结果。

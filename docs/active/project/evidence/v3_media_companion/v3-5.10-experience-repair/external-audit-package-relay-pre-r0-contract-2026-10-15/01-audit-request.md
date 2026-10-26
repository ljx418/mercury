# V3 P0 Background Capture Relay 独立文档审查请求

日期：2026-10-15。审查性质：只读文档审查。请从 `AUDIT_MANIFEST.md` 复算全部载荷 SHA-256，再阅读本文件与 08-11。

## 背景

真实静音 visible Chrome 已触发 extension action，但 Offscreen Document 的 Runtime WebSocket 请求未抵达 Runtime；同一浏览器 Background Service Worker probe 与 Windows ClientWebSocket 均可连接。最新 run 非零失败、cleanup/secret 0。候选路线将 Runtime WebSocket ownership 移到 Background，Offscreen 只经受信内部 Port 发送有序 PCM。

## 审查问题

1. 是否保持 PRD 的一次可信动作、30 秒 grant、本地 ASR、同源权威、无原始媒体云上传和 cleanup 边界？
2. Background/Offscreen/Runtime 的实体职责、Port 身份、sequence/backpressure、stop/finalize/abort 和 worker restart 语义是否可实现且无循环？
3. R0-R7 是否足以指导自动化实现，是否缺少公共合同冻结或代码所有权？
4. A01-A14、负例矩阵和真实 Chrome/Uvicorn 门槛能否拒绝 mock PCM、runner 越权、测试总数和跨 run 假绿？
5. 实施提示词是否越权启动 P1-P9，或允许延长 ticket、放宽 Origin、输出秘密/私有路径？
6. 是否存在 Fatal/Major 使当前候选不得请求用户实施授权？

## 期待输出

落盘独立报告，列出输入 hash、复算方法、Fatal/Major/Minor、文档覆盖和限制。门禁原话只能二选一：

- `DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`
- `DOCUMENT REPLAN / IMPLEMENTATION NO-GO`

本审查不运行产品代码、Chrome、Runtime、Provider 或真实媒体，不修改主工作树，不授权实施。

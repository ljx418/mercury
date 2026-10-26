# V3 P0 Background Capture Relay 独立文档审查请求

日期：2026-10-15。性质：v2 immutable candidate 只读文档外审。先复算 AUDIT_MANIFEST.md 的 18 项 payload，再运行 `17-internal-relay-v2-verifier.py`；审查期间不得修改本目录，不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。

## 已知事实

visible muted Chrome 已触发真实 extension action，但 Offscreen Document 的 Runtime WebSocket 请求未抵达 Runtime；同一浏览器 Background Service Worker 和 Windows ClientWebSocket 均可连接。最新 run 非零失败，cleanup/secret 0。

候选路线：Background 持有 Runtime WebSocket；Offscreen 只采集/降采样，经 exact-sender internal Port 发送有序 PCM。用户动作、30 秒 ticket、公共 Runtime API、SourceAuthority、Side Panel materialize 和隐私边界不变。

v1 已由独立架构审查拒绝：Chrome Port 不支持 transfer-list ArrayBuffer，新 worker 也不能直接查询 Runtime sink。当前只审 v2 Base64/credit/restart-observer 候选，不得把 v1 的 14/14 当作依据。

## 审查问题

1. PRD、架构、开发计划、验收计划、Stage Gate 和专项文档是否一致？
2. Chrome JSON Port、Base64 raw/encoded 上限、单信用、producer/Port/Runtime 总 outstanding 32 chunks/1.5 MiB raw、abort-without-drop、超时和 FailureCode 唯一映射是否可实现且安全？
3. worker restart、Port/WS disconnect、cancel、tab navigation、Runtime crash、SIGTERM 和 cleanup 是否 fail-closed？
4. R0-R7 是否完整支撑后续自动化开发，是否错误扩大公共合同或用户步骤？
5. A01-A14、15 步 positive trace 与 RLY2-N01..N24 能否拒绝 mock/空 PCM、runner 越权、跨 run、无限 queue、秘密泄漏和 cleanup 假绿？
6. 实施提示词是否保持“外审 + 明确授权后才编码”和 P0 出门前 P1 blocked？
7. streamId 一次性边界、sender frame/document/incognito、restart marker 熵/phase/expiry/accessLevel 是否闭合？Runtime finally + 后续 fresh `started` 是否足以构成 sink-zero 的可观察验收，而不让 worker 自证？

## 输出

只允许新增独立报告到 evidence 对应目录。报告列输入 hash、复算命令、Fatal/Major/Minor、限制和门禁原话：

- DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION
- DOCUMENT REPLAN / IMPLEMENTATION NO-GO

文档 PASS 不等于 R0-R7、P0、P1 或 V3 PASS。

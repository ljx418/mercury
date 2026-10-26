# V3 P0 Background Capture Relay 独立文档审查请求

日期：2026-10-15。性质：v4 immutable candidate 只读文档外审。先复算 AUDIT_MANIFEST.md 的 18 项 payload，再运行 `17-internal-relay-v4-verifier.py`；审查期间不得修改本目录，不得运行产品代码、Chrome、Runtime、Provider 或真实媒体。

## 已知事实

visible muted Chrome 已触发真实 extension action，但 Offscreen Document 的 Runtime WebSocket 请求未抵达 Runtime；同一浏览器 Background Service Worker 和 Windows ClientWebSocket 均可连接。最新 run 非零失败，cleanup/secret 0。

候选路线：Background 持有 Runtime WebSocket；Offscreen 只采集/降采样，经 exact-sender internal Port 发送有序 PCM。用户动作、30 秒 ticket、公共 Runtime API、SourceAuthority、Side Panel materialize 和隐私边界不变。

v1-v3 已分别因 transfer-list、stop/drain 和机器验证假绿被拒绝。当前只审 v4 候选，不得把旧 summary 当作依据。

## 审查问题

1. PRD、架构、开发计划、验收计划、Stage Gate 和专项文档是否一致？
2. Chrome JSON Port、九类实际消息 Schema、Base64 raw/encoded 上限、单信用、producer chunk ownership/32 chunks/1.5 MiB raw、abort-before-overflow、超时和 FailureCode 唯一映射是否可实现且安全？
3. worker restart、Port/WS disconnect、cancel、tab navigation、Runtime crash、SIGTERM 和 cleanup 是否 fail-closed？
4. R0-R7 是否完整支撑后续自动化开发，是否错误扩大公共合同或用户步骤？
5. A01-A14、24 步主链、7 步重启链与 RLY4-N01..N30 能否拒绝 mock/空 PCM、runner 越权、跨 run、不可达 stop/drain、无限 queue、秘密泄漏和 cleanup 假绿？
6. 实施提示词是否保持“外审 + 明确授权后才编码”和 P0 出门前 P1 blocked？
7. streamId 重用、sender 六字段、五 marker 实例/18 分钟 expiry、Runtime 单 sink + 7 步 restart trace 是否闭合？请主动变异未知 FailureCode、第十消息、decoded length、padding、trace 任意字段、marker expiry 与 restart cleanup，确认 verifier 非零。

## 输出

只允许新增独立报告到 evidence 对应目录。报告列输入 hash、复算命令、Fatal/Major/Minor、限制和门禁原话：

- DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION
- DOCUMENT REPLAN / IMPLEMENTATION NO-GO

文档 PASS 不等于 R0-R7、P0、P1 或 V3 PASS。

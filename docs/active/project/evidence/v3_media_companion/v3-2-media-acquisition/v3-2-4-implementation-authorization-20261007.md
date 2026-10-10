# V3-2-4 高风险实施授权

日期：2026-10-07。授权主体：当前用户。状态：`AUTHORIZED`。

- 授权原话：`approved V3-2-4 trusted tabCapture implementation (V3-2-4-0..7 only)`。
- 授权文本 SHA-256：`de6faffa97305c894b8135cbd144254cae014cfe4c77e3d0dd290a920758b4f2`。
- 允许范围：`V3-2-4-0..7`，仅冻结的 trusted tabCapture fallback、Runtime grant/WebSocket/sink、Offscreen 生命周期、SenseVoice 接线和 TC01..TC20 真实验收。
- 允许权限增量：`tabCapture`、`offscreen`。
- 禁止：新增 host permission、`<all_urls>`、后台自动录音、持久化 ticket/streamId/raw audio、content script/page 持有秘密、绕过 trusted click。
- 重新授权条件：任何权限扩大、后台自动 capture、原始音频持久化、超过 900 秒或修改 TC01..TC20 固定分母。

本授权不放行 V3-2-5+、V3-3+、V3-5 人工验收或 V3 整体声明。

# V3-2-2 路线 B 外部文档审查请求

日期：2026-10-06。请从 `AUDIT_MANIFEST.md` 开始，独立重算全部 payload SHA-256，不信任候选自报。

## 决策请求

请给出 Fatal/Major/Minor，并明确回答：

1. Revision 4 是否保持 12 URL 与 6+3+1+1+1，同时将 ASR 分母严格固定为 1 natural + 2 audited failure？
2. 两个受控故障是否要求“注入前真实字幕发现”与“注入后真实媒体”双边证据，能否拒绝 fixture/跨 run 假绿？
3. 故障机制是否无法由生产 Runtime API、环境配置、Acquirer 参数或用户 UI 触达？
4. PRD、架构规格、开发计划、验收计划、威胁模型、Schema 与 semantic builder 是否一致？
5. 多 P 当前 cid/part identity、Cookie 隔离、SSRF、restricted、清理与秘密扫描是否足以支撑 B-1..B-6 自动实现？
6. 是否存在缩小 PRD、把 V4 质量回退混入 V3、或把文档/Schema PASS 扩大为产品 PASS？

## 期望决定

只有 `Fatal=0 / Major=0` 才允许进入用户已授权的 V3-2-2 Route B 产品实现。审查结论请保存到：

`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/route-b-independent-document-audit.md`

禁止运行真实 Cookie、Chrome、B站下载、旧报告生成器或产品 validator；本轮是文档与机器合同只读审查。


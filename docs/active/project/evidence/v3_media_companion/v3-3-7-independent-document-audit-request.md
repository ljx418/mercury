# V3-3..V3-7 剩余开发文档独立审查请求

日期：2026-10-06。第三轮只读复审 `docs/active/project/external-audit-package/`，先读 `AUDIT_MANIFEST.md`，独立重算载荷 hash。不得修改仓库、运行真实 Provider、读取秘密或把 fixture 当生产事实。

首轮反馈为 Fatal=0/Major=0/Minor=3；第二轮确认 Schema 层修订，但指出跨字段语义校验器未作为审计载荷。本轮必须重点复算：逐 dispatch consent/撤销后零请求、seek delta/located identity/媒体时长边界、Human overall/judgment 一致性、CAS/时间线/evidence closure，以及 final 分母绑定。不得因内部闭环文档自报而直接关闭问题。

`19-semantic-verifier.py` 是只读审计工具，不是产品实现。必须从审计包目录运行 `python3 19-semantic-verifier.py --package .`，要求 5 份 Schema meta、6 个 positive instance 和 10 个语义负例全部通过；还需独立阅读其规则，不能只信 summary。

## 审查目标

判断剩余 V3 文档是否完整保留 PRD B站首版体验、能否在前序关闭后指导自动化开发、是否能拒绝缩分母/跨 run/mock/代签/秘密泄漏，以及当前实现 NO-GO 是否诚实。

## 必查

1. V3-3 24/12/8/1280 预算与 10 OCR/8 VLM 是否一致；授权前/撤销后是否 0 新上传。
2. V3-4 SQLite aggregate/event/outbox 同事务、CAS、崩溃恢复和三视图纯投影是否可实现。
3. V3-5 A01..A18 与 H01..H10 是否分离；人类是否只判断可见体验，不补机器证据。
4. Ask visual question 是否必须引用视觉 evidence；五类 seek 是否回读真实播放器且 <=2 秒。
5. product/human schemas 是否拒绝四视口缩减、V4 import、automation reviewer、未执行 H 项、seek delta 超限/identity 不一致、false overall PASS 和 BLOCKED precedence。
6. V3-6 A01..A20、12 页 6+3+1+1+1、故障/清理/public-private/seal 是否无缩分母。
7. final candidate 是否必须 false/pending，final disposition 是否只在 Fatal=0/Major=0 后允许 exact claim。
8. 旧 V3-0 umbrella schema 是否会覆盖新 stage contracts。
9. 所有继承 Major 是否保留，是否存在文档通过即越过 V3-2/Provider/用户授权的路径。

## 独立复算

- 19 项 payload hash 与权威源一致性。
- 5 份 Schema meta 与 6 个 positive instances。
- 固定 ID 集合和至少九类负例：预算、撤销后 dispatch、跨 task、未闭合 evidence、seek delta/identity、H 缺项、H 总判定、12 页重分类、提前 final/扩大声明。
- 实跑 `19-semantic-verifier.py`，并至少另构造一个 dispatch sequence gap、一个 CAS replay、一个 seek 超时长和一个 sample identity reuse 负例验证 fail-closed。
- 输出 Fatal/Major/Minor、逐问题结论、允许/禁止项和文件/行号。

建议审查结果落盘：`docs/active/project/evidence/v3_media_companion/v3-3-7-independent-document-audit.md`。

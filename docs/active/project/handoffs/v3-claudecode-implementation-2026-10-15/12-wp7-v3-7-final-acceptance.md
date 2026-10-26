# WP7：V3-7 最终独立审计与收口

状态：`BLOCKED BY WP6 IMMUTABLE CANDIDATE`。本包由 Codex执行，不交给 ClaudeCode 实施。

Codex重算 manifest/seal/schema/fixtures/A01-A20、Revision 5 Route B3 的 12 页分类、Provider/model/assets、cleanup/secret scan、Stage B B-7 审计结论及 H/V3-5.1/CX submission build/run/hash binding；抽查原始日志、截图、网络/DB 观察和失败路径。隔离 Codex Agent 做最终只读审查，Fatal=0/Major=0 才进入收口。

同步 PRD、架构、开发/验收计划、stage gate 和 Draw.io 到实际代码；生成中文 HTML 报告，明确已验收/受限/规划/No-Go，提供真实截图、最小人工步骤、证据和限制。若实现、图纸、计划或签署不一致，返回对应 WP，拒绝声明通过。

最终通过后才做范围清晰的 Git 提交和 `sync-project-progress`。限定声明不得扩大到 YouTube/小红书/直播/V4/V5。

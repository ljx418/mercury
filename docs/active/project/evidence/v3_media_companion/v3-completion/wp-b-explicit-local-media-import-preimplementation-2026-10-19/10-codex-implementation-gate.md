# WP-B Codex 产品实现门限

日期：2026-10-19  
坐标：`V3 post-R7 / WP-A PASS / WP-B preimplementation complete`  
裁决：`WP-B IMPLEMENTATION MAY START`

## 通过事实

- WP-A checkpoint 保持 PASS；relay v11 历史证据不修改。
- WP-B 文档 verifier：`95/95 PASS`。
- JSON Schema：3 个 Draft 2020-12 meta-valid；公共/内部 fixtures 与 negative mutations 全绿。
- Archify：12 个实体；showcase `9/9`；composition errors=0、warnings=0；spec SHA-256 `b602a5e86968727979dfc2f0ec25e22f251abbc96d3b18ac24513a2fba4e1ec1`；HTML SHA-256 `a5925ef8c01e16ee80087620eb9f7627dc8c880c8dc501f7448fecebaa048b73`。
- 独立文档审查意见已逐项闭环：Fatal/Major/Minor=`0/0/0`。
- 本轮只修改 PRD/架构/合同/fixture/原型/计划/门禁，没有实施 WP-B 产品代码，没有启动 Chrome、Runtime、Provider 或声音。

## ClaudeCode 授权范围

只允许按照 `04-development-plan.md` 的 B0-B8 和 `05-acceptance-plan.md` 的 B01-B30 实施 WP-B。权威实施提示词只有：

`docs/active/project/evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-preimplementation-2026-10-19/07-claudecode-implementation-goal.md`

ClaudeCode 不得修改已冻结 schema、18 码、阈值、B01-B30 分母、Origin/auth 顺序、T1-T4、资产 registry 或 WP-A/relay v11。若实现事实证明合同不可实现，必须 `WP-B NO-GO` 停止交回 Codex，不得自行放宽。

## 停止点

ClaudeCode 完成产品实现、自验证、真实数据与 evidence 后，只能写 `WP-B AWAITING CODEX CHECKPOINT` 并停止。不得宣布 WP-B/V3 PASS，不进入 WP-C，不做独立文档外审，不 commit/push/reset/clean/checkout/revert。

若 B29/B30 需要可见 Chrome，必须先通知用户；一次集中运行、owned profile、显式 `--mute-audio`、不抢焦点并清理。若没有满足 registry 的私有有声动态 seed，写 `WP-B NO-GO`，不得用稀疏文件、填零或 mock 替代。

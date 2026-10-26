# WP5：Chat/Know、综合交互与人工签署

状态：`BLOCKED BY WP4 AND CODEX CONTRACT FREEZE`。

开始前 Codex必须关闭 `v3-chat-know-product-convergence.md` 的 IMPLEMENTATION NO-GO，核对 `v3_knowledge_workspace_v1.schema.json`，补齐 ContextEnvelope/Draft/Item transaction fixtures、FailureCode、G1-G6 自动分母和实施前审计。ClaudeCode不得自行冻结。

## G1-G6 固定范围

- G1：桌面图标手动启动、一次配对、真实状态、停止/重启；扩展不自动拉起。Settings 显示 Runtime/version/task/ASR requested/effective/下载/磁盘/内存/显存及手动安装恢复。
- G2：固定 MDN/Python/Wikipedia 三网页；正文、提问、摘要、来源；页面变化失效旧上下文；无正文 fail closed。
- G3：六视频 Chat、真实 route、状态和反跳、0 残留。
- G4：Draft 编辑、取消 0 写入、重复确认 1 Item、revision conflict 可见。
- G5：Know 真实 CRUD、标签/字段/优先级/排序/aging/archived/删除/来源/重启，Mock success=0。
- G6：生产一级导航仅 Chat/Know，Settings 辅助，Agent/Debug 不作为一级入口。

Chat 另须一次操作总结、300ms 内可见状态、增量渲染、主动上滚不抢焦点、Provider 配置持久、新聊天空白、单删/全清有效、四视口不截断。密钥只在系统凭据库。

同一 production build 完成普通网页、六视频、Side Panel/Workspace、四视口、Axe、键盘、刷新、Runtime 重启、Provider 失败和固定负例，生成机器候选后停止。

Codex机器审查通过后才组织用户签署：H01-H10、V3-5.1 human review、CX-H01-CX-H06。submission 必须绑定本 WP 的 build/run/bundle/hash；任何未执行/blocked/失败项禁止 WP6。ClaudeCode不得写人类字段。Stage B 的 B-7 已在 WP2 后由 Codex完成，不得在此重命名或替代。

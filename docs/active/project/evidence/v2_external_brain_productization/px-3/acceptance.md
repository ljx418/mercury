# PX-3 验收记录

日期：2026-09-08

结论：PASS；Fatal 0，Major 0。

- focused tests：4 文件、27 项通过。
- frontend full tests：18 文件、148 项通过。
- typecheck、production build：通过。
- Runtime V2 API：4 项通过。
- PX-0.2：9 Schema、65 正例、109 负例通过。
- Chrome：51/51 checks；route recovery 20/20；8 并发单 tab；0 ingest。
- Runtime lifecycle：offline 四域正确，解除 transport fault 后自动恢复 online 并重新出现真实 PRD source。
- ID：Side Panel 与 Workspace 同时显示 `src_000...002`、`op_000...003`。
- tab lifecycle：关闭后用户再次触发得到 `created_new`；下一次 fresh query 得到同 tabId 的 `focused_existing`。
- 截图实际尺寸：Side Panel 360x900/420x900；Workspace 1280x900。

首次全量命令因工作目录/PYTHONPATH 错误未执行测试，已用正确命令完整重跑。首次 Chrome reconnect 断言错误地要求 data_service 不为 `unchecked`；真实 Runtime 合法在线状态即为 Adapter ready/data_service unchecked，断言已按权威语义修正并完整重跑。

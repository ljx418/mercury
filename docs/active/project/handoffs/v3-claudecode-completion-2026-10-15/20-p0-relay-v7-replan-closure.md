# P0 Relay v7 重规划闭环

日期：2026-10-15。状态：`V7 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / P1 BLOCKED`。

## v6 严格审查结论

v6 Claude 文档审查给出 PASS，但第二独立 reviewer 发现 Fatal=0、Major=5、Minor=1。按更严格结论，v6 已归档为 rejected，不得实现：

1. 权威 task 已 succeeded 后，`completed` frame 发送失败不能再把同一 task 改成 failed。
2. 既有 recover API 不返回候选虚构的 cleanup receipt；`interrupted` 是由持久 owner PID/start token 推导，不是持久状态字段。
3. 公共 Runtime/UI code 与 relay code 的 inventory 不闭合，且缺少 `V3_MEDIA_CLEANUP_INCOMPLETE` 的唯一 rename。
4. 专项架构仍指向 v5 机器合同，破坏唯一权威。
5. acquisition、consent、transcript、outline、workspace 不属于同一 revision 域，不能验收“全链同 revision”。

## v7 逐项闭环

| v6 Finding | v7 冻结修订 | 可执行验收 |
|---|---|---|
| M1 terminal 矛盾 | durable task 在 sink finalize、transcript create/start、coordinator complete 返回 succeeded 后提交；`completed` 是最佳努力通知 | 前四个注入点为 failed+cleanup 0；completed send 失败保持 succeeded，GET 返回同一终态 |
| M2 recover 收据虚构 | hard crash 由持久 owner PID/start token 推导 interrupted；只使用既有 recover 的 HTTP、disposition、authoritativeTaskId、authority 与 fresh begin | recover 成功且 authority terminal/published；fresh begin 成功；cleanup 非零时既有实现公开失败 |
| M3 code inventory 不闭合 | 冻结 30 个公共 source、20 个 relay target，以及 identityShared、renameMapping、publicOnlyNotEmittedOnRelayWire 三个完备互斥集合 | verifier 检查精确并集、互斥、target 集与 cleanup rename |
| M4 路径陈旧 | 专项架构、计划、验收、审计与交接只把 v7 schema/fixture/verifier 作为当前机器权威 | stale-reference 检查不得在当前权威段指向 v1-v6 |
| M5 revision 不可判定 | taskId/sourceIdentity 在存在字段的层一致；consent、transcript、product revision 各自单调并执行 fence；outline/workspace 共享 product revision | 拒绝跨域 revision 强制相等；分别验证单调性与 product expected-revision fence |

## v7 机器合同

- Schema：`docs/active/project/contracts/v3_media_capture_internal_relay_v7.schema.json`
- Fixture：`docs/active/project/fixtures/v3-media-capture-internal-relay-v7-fixtures.json`
- Verifier：`docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v7-contract.py`
- 当前基线：36/36 PASS。
- 必须拒绝的变异：Schema 放宽、旧 port、未知/遗漏 code、cleanup rename、trace/case、terminal notification、recover 观察面、sender context、marker 与 revision 域。

36/36 只证明静态候选与冻结字节一致，不证明实现存在。必须重建平铺外审包，并由 Claude Code 与另一个独立 reviewer 都给出 Fatal=0/Major=0；随后仍需用户精确授权 `approved P0 Background Capture Relay R0-R7 implementation`，主干才可改产品代码。P1 六视频继续 BLOCKED。

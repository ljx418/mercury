# V3-2-3 实施出门独立审查请求

日期：2026-10-07。审查对象：`docs/active/project/external-audit-package/` 当前平铺包。候选 run：`v3-2-3-sensevoice-20261007T044217Z`。

## 请求决定

请给出：`V3-2-3 LIMITED PASS` 或 `FAIL/REPLAN`，并按 Fatal/Major/Minor 分类。通过仅允许进入 V3-2-4 高风险实施授权前的详细复核；不得扩大为 V3-2、V3、视频理解、图文大纲或生产质量认证。

## 必读顺序

1. `AUDIT_MANIFEST.md`：逐项重算 SHA-256，并确认权威源与平铺副本一致。
2. `01-audit-request.md`、`02-prd.md`、`03-stage-gate.md`。
3. 开发/验收/威胁/授权/第二轮文档审查与 B3 amendment。
4. 解包 `13-implementation-source.tar.gz` 与 `14-public-run-evidence.tar.gz` 到隔离目录，只读复算。
5. 验收结果、PRD 检视、内部候选审计与 handoff。

## 必须独立回答

1. 三个固定 slot 是否属于同一全新 run，是否从零执行真实 acquisition，是否存在旧 B3/失败 run 拼接？
2. 三槽是否全部使用冻结 SenseVoiceSmall Q8 + FSMN-VAD，并完成全长而非窗口转写？
3. VAD count、SRT count、coverage=1.0、segment 时间和 content hash 是否可从公开 receipt 独立复算？
4. 运行中取消及 timeout/nonzero/output overflow/empty/bad SRT/VAD mismatch 是否 fail closed，并只发布固定公开 FailureCode？
5. native child 是否限制为 <=8 cores、8 GiB、无 GPU，并由 seccomp 拒绝网络？资源 receipt 是否低于门槛？
6. Runtime API 是否 closed-body，禁止客户端传 path/Cookie/provider class/model path/stderr？
7. ASR staging 与 acquisition sandbox 是否双层清理，成功 run 私有根是否不存在？
8. 公开证据是否不含 Cookie 真值、正文、音频、stderr 和私有路径？真实 Cookie needle 扫描是否为 0 hit？
9. Route B3 acceptance fault 是否只在 runner 可达，生产 Runtime/API/Acquirer 静态不可达？
10. Revision 3 的 1200 秒历史约束与 Revision 5 长媒体能力槽位是否已在活跃文档中消除冲突，且未放宽低资源硬门槛？
11. ST01..ST20、Runtime 474、frontend 293、credential 25+9+2 与 seal 是否一致？
12. 是否仍有任何 Major 足以阻止 V3-2-3 limited pass 或放行 V3-2-4 授权前复核？

## 审查约束

- 只读审查；不得修改主工作树、旧 run、候选 run 或 seal。
- 可运行 Python 标准库、jsonschema、sha256sum、tar 隔离解包和候选源码测试；不得读取或输出用户 Cookie 文件。
- 不运行旧 PX generator/validator，不启动 V3-2-4 tabCapture，不把公开 hash 当作 transcript 正文。
- 审查结果请落盘到：`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-independent-implementation-exit-audit-20261007.md`。

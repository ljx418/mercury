# Codex 独立验收与交接协议

ClaudeCode 每完成一个工作包，用户把其输出交回 Codex。Codex读取工作树和证据，不采信摘要。

## 接收与复算

1. `git status --short --untracked-files=all`、相关 diff、candidate/verification/PRD review/handoff/manifest。
2. 核对文件所有权、公共合同变化、命令/退出码、版本、build/run/task ID、固定分母、cleanup/scan 和人类字段未被实施者填写。
3. 复跑最小高价值 Schema/合同/失败退出/typecheck/build/pytest/node/hash/scan。
4. 抽查真实 Chrome/Provider 原始日志、截图、网络/DB 和 cleanup receipt；证据不足要求重跑。
5. 拉起未参与实现的 Codex 独立 Agent，只读审查 PRD/架构、代码/合同、固定分母、false-green、真实数据、隐私/清理和适用的 UI/内容质量。

## 结论

只能给出：

```text
WORKPACK PASS / NEXT WORKPACK MAY START
WORKPACK LIMITED PASS / NEXT WORKPACK BLOCKED
WORKPACK FAIL / RETURN TO SAME WORKPACK
WORKPACK REPLAN / USER DECISION REQUIRED
```

报告包含状态、changed files、测试/真实 run、PRD 覆盖、Fatal/Major/Minor、证据、风险、下一门禁和停止原因。Fatal 包括秘密/私有媒体泄漏、历史证据破坏、非 owned 资源终止、声音播放或不可恢复破坏；Major 包括缩分母、跨 run、未授权合同变化、runner 吞错、Mock 假绿、内容错误、权威分裂、UI 终态错、cleanup 非零和架构不一致。

Minor 转成测试/限制/下一义务，不为 Minor 反复制造文档版本。

## 文档冻结职责

在 WP3、WP4、WP5、WP6 前，Codex按 `03-master-roadmap.md` 补齐该包要求的机器 schema、fixtures、FailureCode、registry、详细计划和实施前审计，并用隔离 Codex Agent 审查 Fatal=0/Major=0；用户明确授权后才交给 ClaudeCode。ClaudeCode提出合同缺口时，Codex评估后修订，不让实施者自行定规格。

WP2 的 B-7 由未参与实现和 B-6 的 Codex 独立 Agent执行；只有 B-7 Fatal=0/Major=0 才能判定完整 Stage B PASS 并冻结 WP3。B-7 不得延迟到 WP5，也不得由 ClaudeCode自审。

## 人工与最终收口

WP5机器通过后，Codex给用户最小步骤、预期结果和结构化回填，组织 H01-H10/V3-5.1 human review/CX-H01..06；人类不检查 hash/schema/scan。全部签署并绑定 same build 后才放行 WP6。WP7 由 Codex重算并出最终 HTML/Draw.io；最终通过后才受控 Git 提交和 `sync-project-progress`。

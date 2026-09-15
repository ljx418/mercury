# T02.3 实施前审计

日期：2026-09-13
阶段：故障状态合同修复和完整 R2 重采启动前
结论：`GO WITH FROZEN SCOPE`

## 1. 输入事实

```text
T02.2 snapshot: fce3aaec9e8c8b7d88b29f60f3a94e63f9390699
T02.2 raw SHA-256: d0309d8bc946229fcef3862508648cef295cf3f124a758be9d3636b8e2eb107d
T02.2 seal: 50489670ce76462105bb923b8b90044f9e3075f225941af5103911208b560624
T02.2 raw successful Status responses: 178
T02.2 raw Status Schema errors: 7
T03 DerivedFacts Status observations: 179 (含 1 条 runtime-offline 前端推断)
```

七个错误均为三个受控故障场景中的 `userAction=retry`。冻结 Schema 已存在三个对应 canonical action，不需要合同迁移。

## 2. 风险审计

| 风险 | 防线 | 结果 |
|---|---|---|
| 通过放宽 Schema 迁就旧证据 | Schema 明确禁止修改；旧 raw 必须继续失败 | PASS |
| 在 Report/DerivedFacts 中归一化 | 校验放在 R2 原始 response bytes 与 seal 之前 | PASS |
| 只校验三条构造值而漏掉实际响应 | 登记本 run 所有成功 Status response；checked 不得为 0 | PASS |
| 状态错误发生后仍写 seal | errors 非零时在 `collector.seal()` 调用前抛错 | PASS |
| 污染脏主工作树或旧 run | 从 T02.2 候选提交创建独立 worktree 和新 snapshot | PASS |
| 缩小真实验收分母 | T02.2 全部分母并入 T02.3-A07..A12 | PASS |

## 3. 实施前测试

```text
node syntax check: PASS
collector tests: 15/15 PASS
canonical fault payloads: 3/3 Schema PASS
generic retry regression: rejected
old T02.2 direct raw audit: 178 checked / 7 errors
```

## 4. 结论

Fatal 0 / Major 0。允许在隔离 worktree 实施批准的 runner/helper/test 修改并创建全新完整 R2 run。T03、T04、PX-6 和 RKM 不因本审计自动放行；T03 只能在 T02.3 外部独立审查 Fatal=0/Major=0 后恢复。

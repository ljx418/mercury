# T01 R1 前端与真实 Chrome 交接

## Module

```text
Module: V2-PX PX-5/T01 R1 frontend and real Chrome
Owner Agent: Codex
Date: 2026-09-11
Stage Gate: T01 acceptance-result.md
```

## Change Summary

```text
Changed files: see changed-files.md
Behavior added: typed Runtime errors, page-private credentials, dual-container cleanup,
PermissionRoot lifecycle, strict Forget, stable E2E identities and real Chrome runner
Behavior intentionally not added: T02 evidence generator/validator, PX-6 human review,
real data_service, RKM or automatic maintenance
```

## Contract Status

```text
Public Runtime API changed: no
Adapter contract changed: no
Data model changed: no
Event type changed: no
Frontend internal API changed: yes, limited to runtimeClient session/error helpers
```

## Evidence

```text
Unit/contract tests: test-results.md
Real data: runs/t01-r1-frontend-20260910T232816/input/authorized-documents/
Chrome evidence: runs/t01-r1-frontend-20260910T232816/raw/t01-real-chrome-run.json
Screenshots: runs/t01-r1-frontend-20260910T232816/screenshots/
Cleanup: runs/t01-r1-frontend-20260910T232816/raw/cleanup-manifest.json
Independent review: independent-audit.md
```

## PRD Coverage

T01 覆盖双容器认证、稳定 ID、服务状态、显式 PermissionRoot、严格 Forget 和真实 Chrome 用户路径。未覆盖 T02、PX-6、真实 data_service、RKM 和完整 V2 声明，详见 `prd-review.md`。

## Integration Handoff

T02 必须以隔离提交 `5a34e5aef0ad493ef4374ad0ead6ea3a1c27fcbd` 和最终 run 为输入，先单独冻结开发计划、验收分母和防假绿审计。不得运行旧 PX 报告生成器来覆盖本轮证据，不得把 T01 的测试专用 bridge 当生产入口。

已知 Minor：poller 短暂状态回落；attempt 7/19 历史证据缺失。任何新的 token 泄漏、身份串联、权限绕过、Forget 假绿或公共合同修改均要求立即停止并返回审计。

## No-Go Self Check

- [x] 未修改 A/C/D 模块实现目录。
- [x] 未绕过 Adapter / Governance。
- [x] 未创建临时事件字符串作为公共合同。
- [x] 未把 mock-only 证据冒充真实 Chrome；T01 使用真实 Runtime、真实文档字节和真实 Chrome。
- [x] 未把 T01 PASS 扩大为 PX-5/PX-6/RKM/V2 complete。

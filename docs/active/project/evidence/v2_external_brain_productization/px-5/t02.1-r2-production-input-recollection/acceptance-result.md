# T02.1 R2 Production Positive 输入全量重采验收结果

日期：2026-09-12  
状态：`PASS（限定 production-positive R2 input）`

## 1. 决策对象

```text
runId: t02-r2-raw-production-input-20260912T053500
snapshotCommit: 9205336cc8ae11024bd9a98e2896dfe37edbdb1e
rawSha256: 711d2f2c976658427148c5b717710d0a8ecf09b83b20aa43210e270d6523b0f2
sealSha256: acdc13434fe140daf5e3ea86abbe10c61ca1fb0509db9de17e10c44f3d4abcb0
adapterMode: mock
```

## 2. 固定分母

| ID | 本地结果 | 证据 |
|---|---|---|
| T02.1-A01 | PASS | 新旧 run 隔离；新 seal 可重算；旧 raw/seal 不变 |
| T02.1-A02 | PASS | 原 T02 A01-A12 全部重新执行；独立审查确认不得继承旧 run 的 PASS 布尔 |
| T02.1-A03 | PASS | 三入口 `2 / 2 / 3`，trusted action 与 Background/route 链完整 |
| T02.1-A04 | PASS | 12-source：6 web + 3 local + 3 note，四类唯一键均为 12 |
| T02.1-A05 | PASS | 五 route × direct/reload/Back/reopen = 20/20 |
| T02.1-A06 | PASS | INVALID_ROUTE、WORKSPACE_NOT_FOUND 均有真实可信回库链 |
| T02.1-A07 | PASS | axe-core serious 0 / critical 0 |
| T02.1-A08 | PASS | keyboard 5/5 |
| T02.1-A09 | PASS | Permission 3、Forget 3、fault 4、四产品视口均通过 |
| T02.1-A10 | PASS | Schema、collector invariant、seal、artifact、terminal、authority、截图、隔离、cleanup 通过 |
| T02.1-A11 | PASS | T03 input readiness exit 0；Fatal 0 / Major 0 |
| T02.1-A12 | PASS | PRD/架构/false-green 检视及 Claude Code CLI 独立审查通过，Fatal 0 / Major 0 / Minor 3 |

固定 12 项全部 PASS，无 N/A。独立审查文件 SHA-256 为 `06afe77ed83c557bd9f4a3725eb135547aa56b2b2e40a9a32f9a69baabd3b020`。该 PASS 只证明本 run 可作为 T03 production-positive 输入，不证明 T03、PX-5、PX-6 或 V2 通过。

## 3. 审计结论

`verify-t02.1-candidate.py` 重算 31 项机器检查，31/31 通过；独立审查再次从权威 run 复算并确认 Fatal 0 / Major 0 / Minor 3。三个 Minor 的处置在 T03 实施前审计中冻结，不扩大本阶段声明。

```text
T02 original limited PASS: unchanged
T02.1 formal gate: PASS within production-positive R2 input scope
T03 preimplementation audit: ALLOWED
T03 implementation: NO-GO pending independent T03 preimplementation review
T04 / PX-6 / RKM: BLOCKED
PX-5: FAIL / REOPENED
```

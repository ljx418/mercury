# V3-2-7 Module Handoff

## Changed files

- 新增 production runner、artifact collector、A01..A20 verifier、deterministic packager。
- Route/Chrome/fault runner 增加显式 runRoot；SenseVoice runner 增加 source run/hash 参数。
- lineage 从历史单 run 常量改为强类型 Route B3 run/hash，并保留固定槽位与唯一性校验。
- V3-2.6 cleanup race 修复及 fault 工具属于前序 V3-2.6 handoff。

## Contract changes

没有修改公开 Runtime API 或 JSON Schema。内部 `TranscriptLineageManifest` 允许新的 `v3-2-route-b3-<timestamp>` 来源；实体内容仍由 SHA-256、固定 3 槽位和唯一 task/source/audio/transcript 约束。

## Tests and real evidence

- 同 run 全量 Runtime、frontend test/typecheck/build 均通过。
- 定向 38 tests passed；Python/Node syntax 与 `git diff --check` passed。
- 真实证据入口：`v3-2-7-production-exit/runs/v3-2-production-20261007T174158Z/`。

## PRD coverage and risks

V3-2 A01..A20 已覆盖；V3-3 视觉证据及之后阶段未覆盖。唯一剩余风险是最终 reviewer 组织独立性，因此 V3-3 实施仍 blocked。

## Integration notes

外审先读 `AUDIT_MANIFEST.md` 与 `01-audit-request.md`。不得引用带 `FAILED.json`/`INVALIDATED.json` 的 run，不得把 `pending/false` 改写为 PASS。

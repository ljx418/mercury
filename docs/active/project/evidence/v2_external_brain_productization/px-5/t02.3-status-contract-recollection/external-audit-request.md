# T02.3 外部独立审查请求

日期：2026-09-14
审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`
目标落盘：`docs/active/project/evidence/v2_external_brain_productization/px-5/t02.3-status-contract-recollection/independent-audit.md`

## 1. 决策问题

请只读独立判断 T02.3 是否达到：

```text
T02.3 limited PASS as the production-positive R2 input for T03
Fatal = 0
Major = 0
```

本审查不得把限定 PASS 扩大为 T03、T04、PX-5、PX-6、V2、RAG 或 RKM 通过。

## 2. 固定候选

```text
runId: t02-r2-status-contract-production-input-20260914T001017
snapshotCommit: 98d3a8be12cd168d10993e996a95e1e11e59c184
raw SHA-256: 7fd641697f508c9e9fb81ab2d3af8a1248b1df61e90c83346617f9b2596266a1
seal contentSha256: 430207668675497c9a9d5b22f8539ae66537c72a172ed35d18fafe8e28ba8270
```

公开归档解包结构：`current-run/`、`old-run/`、`build/`。请使用 `tar --same-permissions -xzf`，避免 Windows/WSL 跨文件系统 mode 误报。

## 3. 必须独立重算

1. `AUDIT_MANIFEST.md` 的 19 个 payload hash，以及 payload 与权威源逐字节一致性。
2. 当前 raw 的 Draft 2020-12 meta/instance、captured collector invariant、artifact index/path/hash/length/reference、canonical seal。
3. 203 个成功 `/v1/knowledge/status` response 的原始 artifact bytes 全部通过冻结 Status Schema。
4. 故障状态映射必须是 `blocked/configure_adapter`、`unreachable/reconnect`、`failed/retry_source_build`；generic `retry` 不得被接受。
5. `old-run/` 必须稳定得到 178 checked / 7 errors，错误只来自三个 fault 场景的 `userAction=retry`。
6. 三入口、12 source、5 route x 4 mode、2 route recovery、3 source x 4 durable Forget、Permission、4 fault、4 viewport、真实 Axe/Keyboard。
7. 557 Runtime request = 540 response + 17 transport failure，7 Background request = 7 response，均 0 orphan/multi-terminal。
8. 当前 run 的 build/typecheck/collector 15/frontend 169/Runtime 307/T01 Chrome 36，以及 cleanup 4/4。
9. 公开包缺失 6 个 private bytes，但所有 public artifact 必须存在并匹配；公开字节不得泄漏凭据或本地私有路径。
10. snapshot 代码范围仅为 R2 runner/helper/test；产品、Runtime、API、Schema 0 修改。

## 4. 失败执行与反证

请确认四个先前尝试均无 sealed raw 且 cleanup 4/4。不得从失败 run 或旧 T02/T02.1/T02.2 拼接当前分母。旧 T02.2 的 7 个错误必须继续存在；若旧 raw 也通过，说明 checker 放宽或归一化，应判 Major。

## 5. 推荐执行

解包 `19-public-evidence.tar.gz` 后，以包内 `14-t02.3-verifier.py` 运行：

```text
--run-root <extract>/current-run
--old-run-root <extract>/old-run
--build-root <extract>/build
--expected-run-id t02-r2-status-contract-production-input-20260914T001017
--expected-snapshot 98d3a8be12cd168d10993e996a95e1e11e59c184
--expected-raw-sha256 7fd641697f508c9e9fb81ab2d3af8a1248b1df61e90c83346617f9b2596266a1
--expected-seal-sha256 430207668675497c9a9d5b22f8539ae66537c72a172ed35d18fafe8e28ba8270
--checker <package>/15-t03-input-readiness.py
--public-package
```

不得只信任 `18-public-package-verification.json` 的自报结论。

## 6. 输出要求

审查报告需列出：Fatal/Major/Minor、A01-A13 逐项结论、19 项 hash 对账、机器复算输出、旧基线反证、范围/PRD/架构检查，以及允许/禁止的下一步。若 Fatal=0/Major=0，只允许更新 T03 baseline 并重新执行 T03 实施前审计与 T03-1..4；不得直接沿用旧 T02.2 的 T03-4 结果。

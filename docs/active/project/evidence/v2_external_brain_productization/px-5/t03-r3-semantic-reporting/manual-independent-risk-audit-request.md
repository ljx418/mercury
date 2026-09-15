# T03 Durable Forget 输入冲突独立审查请求

日期：2026-09-12  
审查入口：`AUDIT_MANIFEST.md`  
审查性质：只读、独立、风险门禁复核；不是 T03/PX-5 通过请求。

## 1. 决策问题

请独立判断：T02.1 sealed raw 是否真实证明 PRD/G3 要求的三个 source x direct-open/reload/Back/reopen `SOURCE_NOT_FOUND + recovered_to_library`，以及该 run 是否仍有资格作为 T03 production-positive base。

候选风险结论是：12/12 条目标 route observation 都没有 `SOURCE_NOT_FOUND`，没有后续 Source Library recovery，仅有 Runtime HTTP 200 返回同一 source 的 `status=forgotten`。若该事实成立，应判定 T03 implementation STOPPED，并要求返回产品修复与全新 R2 采集，不允许由报告层合成缺失字段。

## 2. 必读载荷

1. `02-prd.md`、`03-architecture.md`、`04-acceptance-plan.md`；
2. `06-execution-observation.schema.json`、`07-semantic-validator-spec.md`、`08-px-development-acceptance-plan.md`；
3. `09-t02.1-acceptance-plan.md`、`10-t02.1-independent-audit.md`；
4. `11-t03-development-plan.md` 至 `15-t03-independent-preimplementation-audit.md`；
5. `16-risk-stop.md`、`17-reproduce.py`；
6. `18-sealed-raw-run.json` 与 `19-public-evidence.tar.gz`。

## 3. 独立复现

不得只信任 `16-risk-stop.md` 的摘要。请在仓库外临时目录执行：

```bash
mkdir -p /tmp/navia-t03-risk-audit/run/raw
cp 18-sealed-raw-run.json /tmp/navia-t03-risk-audit/run/raw/raw-run.json
tar -xzf 19-public-evidence.tar.gz -C /tmp/navia-t03-risk-audit/run
python3 17-reproduce.py --run-root /tmp/navia-t03-risk-audit/run
```

预期候选输出为非零退出码、12 条 observation、24 个缺口、`eligibleAsT03ProductionPositiveBase=false`。审查者还需自行抽样至少一个 source 的四种模式，读取 route payload、authority event 和 Runtime response bytes，不能只复述脚本结果。

## 4. 需要回答

- 19 个载荷 SHA-256 是否与 manifest 一致；
- raw 文件 SHA-256 和嵌入 seal 是否保持冻结值；
- PRD、架构、Execution v6、semantic validator 对 Forget 的要求是否一致；
- 12 条 raw observation 是否具备 `SOURCE_NOT_FOUND`；
- 每条场景是否存在恢复到 Source Library 的 route observation；
- Runtime `status=forgotten` 能否单独替代用户可见错误与恢复；
- T02.1 历史 raw/schema/collection PASS 与 T03 positive-base eligibility 应如何分界；
- 推荐 T02.2 修复路线是否为最小、不缩小 PRD 的方案；
- 是否存在 Fatal/Major/Minor，以及是否允许恢复 T03。

## 5. 禁止项

- 不运行旧 production generator/validator；
- 不修改 sealed raw、artifact、seal 或独立审查原文；
- 不把缺失字段补入 Report/Execution；
- 不把隔离 worktree 的局部 `109/109` 或 `42/42` 结果视为 T03 PASS；
- 不进入 T04、PX-6、RKM；
- 不将 T02.1 的其他限定通过项一并撤销，除非给出新的独立证据。

## 6. 结果落盘

请将独立审查保存为：

```text
docs/active/project/evidence/v2_external_brain_productization/px-5/
t03-r3-semantic-reporting/independent-risk-audit-durable-forget-2026-09-12.md
```

只有独立审查与用户路线决定完成后，才允许制定并审查 T02.2 的实质开发计划。

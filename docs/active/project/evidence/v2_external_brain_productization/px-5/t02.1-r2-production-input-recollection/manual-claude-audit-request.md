# T02.1 Claude Code CLI 独立审查请求

日期：2026-09-12  
候选状态：`LOCAL CANDIDATE PASS / INDEPENDENT REVIEW PENDING`

## 1. 请求

请从外部审计包的 `AUDIT_MANIFEST.md` 开始，随后阅读 `01-audit-request.md`。对 `t02-r2-raw-production-input-20260912T053500` 做独立、只读、fail-closed 审查，按 T02.1-A01..A12 给出 PASS/FAIL 和 Fatal/Major/Minor。

最终决策只能是：

```text
T02.1 PASS（限定 production-positive R2 input），只允许重开 T03 实施前审计
或
T02.1 FAIL，列出可复现 blocker
```

## 2. 必须独立重算

- raw Schema meta/instance、captured collector invariants、canonical seal；
- 953 个 artifact 的 path/hash/length/index，以及 947 public / 6 private_local_only 分类；
- 454 个 Runtime 与 7 个 Background request 的 exact-one terminal；
- 三入口 2/2/3、五 route × 四恢复、同 navigation authority；
- 12 source 的不同原始字节和 Runtime source/operation ID；
- INVALID_ROUTE 与 WORKSPACE_NOT_FOUND 的真实错误页、trusted 恢复动作和回库观察；
- Axe serious/critical 0、keyboard 5/5；
- Permission 3、Forget 3、四类同源重开、四 fault、四视口；
- fresh build 91 文件、collector 11、frontend 169、Runtime 307、T01 Chrome 36；
- 旧 accepted T02 raw/seal 不变，五个失败 run 无 seal，新 run 无跨 run 引用；
- cleanup、公开字节脱敏和 PRD/架构/false-green 边界。

## 3. 不得采用

- 不得采信 `candidate-verification.json` 的 PASS 而跳过独立重算。
- 不得运行旧 generator 或旧 production validator 生成替代报告。
- 不得把 Mock Adapter 写成真实 data_service。
- 不得将 T02.1 结果扩大为 T03、PX-5、PX-6、V2、完整外脑或 RAG ready。

建议结果路径：

```text
docs/active/project/evidence/v2_external_brain_productization/px-5/
  t02.1-r2-production-input-recollection/independent-audit.md
```

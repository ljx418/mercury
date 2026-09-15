# T02.2 本地双轮只读审计

日期：2026-09-12
性质：同一实施代理的隔离复核，不替代外部独立审查。

## 1. 第一轮：证据完整性与可重算性

审查输入为 sealed raw、captured Schema/collector/build index、artifact index、真实 artifact bytes、cleanup 和旧 T02.1 raw。未信任候选结论字段。

结果：

- Draft 2020-12 meta/instance validation：PASS；
- captured collector invariant：PASS；
- raw SHA-256 与 canonical seal：PASS；
- 91 个 build 文件 path/mode/length/hash：PASS；
- 1105 个 artifact 与 index 一致，1099 public + 6 private 全部逐字节匹配；
- 530 Runtime request = 515 response + 15 transport failure，exact-one terminal；
- 7 Background request = 7 response；
- 2 个 Runtime/browser segment 连续、互异且覆盖全部 1321 events；
- public credential/private-path scan：0 hit；
- cleanup 四项：全部 true。

第一轮结论：`Fatal 0 / Major 0 / Minor 0`。

同一 verifier 在公开归档解包目录以 `--public-package` 再执行为 33/33。该模式要求 1099 个 public artifact 全部逐字节存在并匹配；6 个 `private_local_only` artifact 必须从归档缺席，但其 path/hash/length/visibility 记录仍受 sealed raw 约束。私有原文字节只在本机完整模式校验。

## 2. 第二轮：语义、PRD 与防假绿

第二轮从 raw event/response bytes 重算，不读取 `ready=true` 作为事实：

- 三入口：`open_workspace=2`、`view_source=3`、`open_in_workspace=2`；
- source corpus：6 web + 3 explicit local + 3 note，12 个 source/operation/fingerprint 均唯一；
- 五 route × direct-open/reload/Back/reopen：20 组合全覆盖；
- invalid recovery：`INVALID_ROUTE`、`WORKSPACE_NOT_FOUND`；
- Permission：3；Forget：3；fault：4；产品视口：360/420/768/1280；
- Axe：0 serious / 0 critical；Keyboard：5/5；
- durable Forget：12 trigger + 12 recovery，无 identity/authority/order/trusted-action 错误；
- 旧 T02.1 raw 被新版 checker 仅以 `T03-IN-09` 拒绝，24 个预期缺失全部精确匹配。

第二轮结论：`Fatal 0 / Major 0 / Minor 0`。

## 3. 尚未完成的独立性门槛

上述两轮由当前实施代理执行，只能支持 `LOCAL CANDIDATE PASS`。外部审查者仍需从平铺审计包独立重算 hash、Schema、artifact、terminal、route/Forget 链、privacy 与旧 run fail-closed。外部结论未落盘前：

```text
T02.2 formal PASS: forbidden
T03 implementation: NO-GO
PX-5: FAIL / REOPENED
```

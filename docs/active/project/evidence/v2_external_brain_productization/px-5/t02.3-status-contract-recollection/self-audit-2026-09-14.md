# T02.3 用户授权自审

日期：2026-09-14
审查者：当前实施代理
性质：`USER-AUTHORIZED SELF-AUDIT`，不冒充组织独立审查

## 1. 结论

```text
Fatal: 0
Major: 0
Minor: 1
T02.3: LIMITED PASS FOR T03 PRODUCTION-POSITIVE INPUT
```

用户明确要求当前代理自行审计 T02.3 并继续 T03，因此本文件关闭 T02.3-A13 的执行阻塞，但保留“未由不同 reviewer session 复核”的组织独立性风险。本结论不等于 T03、T04、PX-5、PX-6 或 V2 通过。

## 2. 独立于候选字段的复算

- 平铺审计包：19 个 payload + 1 manifest，19/19 SHA-256 与权威源一致，0 子目录。
- 公开归档：2401 members，0 private bytes；使用 `tar --same-permissions -xzf` 解包。
- 包内 verifier 与 checker：34/34，Fatal 0 / Major 0。
- raw：1375 events、1158 artifacts，1152 public + 6 private metadata-only。
- Runtime：557 request = 540 response + 17 transport failure，0 orphan/multi-terminal。
- Background：7 request = 7 response，0 orphan/multi-terminal。
- seal：canonical JSON 重算与 `430207668675497c9a9d5b22f8539ae66537c72a172ed35d18fafe8e28ba8270` 一致。
- cleanup：browser/runtime/fixture/profile 4/4 true。

## 3. Status 正反证

新 run 从 203 个成功 `/v1/knowledge/status` response artifact 原始字节解析 `data`，逐项通过冻结 Draft 2020-12 Schema，0 error。故障期的状态与动作精确为：

```text
adapterStatus=blocked -> configure_adapter
dataServiceStatus=unreachable -> reconnect
sourceBuildStatus=failed -> retry_source_build
```

恢复期 Status 使用 `userAction=none`，不被错误计入故障映射。旧 T02.2 在同一 checker 下仍为 178 checked / 7 enum errors，分布为 adapter 2、data service 3、source 2，全部由 `userAction=retry` 触发。该反证证明没有放宽 Schema或在派生层静默归一化。

## 4. PRD 与真实验收分母

- 三入口：open_workspace 2、open_in_workspace 2、view_source 3；
- 来源：6 web + 3 explicit local + 3 note，共 12；
- 路由：五类 route x direct-open/reload/Back/reopen 全覆盖；
- 普通错误恢复：INVALID_ROUTE、WORKSPACE_NOT_FOUND；
- durable Forget：12 trigger + 12 trusted recovery + 12 authority absence；
- Permission 3、fault 4、产品截图 360/420/768/1280；
- Axe serious/critical 0，Keyboard 5/5；
- build/typecheck、collector 15、frontend 169、Runtime 307、T01 real Chrome 36 全通过。

T02.3 未修改产品 UI、Runtime、API、Schema、RuleId、109 requirements 或 G1-G7，只修改 P7 采集与校验代码。四个失败 run 均无 seal 且 cleanup 4/4，未进入候选。

## 5. Minor 与处置

`M-1`：审查者与实施者是同一代理，不具备组织独立性。处置：在所有状态文档中显式标记 self-audit；用户已明确授权继续 T03；T03 实现后出门仍需新的实际产物审计，不得把本文件当作 PX-5 最终独立签署。

## 6. 允许与禁止

允许：把 T03 唯一 production-positive 输入更新为 T02.3，重新执行 T03-1..4，再按子阶段门禁推进 T03-5..7。

禁止：修改 T02.3 sealed raw；跨 run 拼接；复用旧 T02.2 DerivedFacts/Validation；运行旧 production generator/validator；自动签署 Human Review；进入 T04/PX-6/RKM；宣布 PX-5/V2 通过。

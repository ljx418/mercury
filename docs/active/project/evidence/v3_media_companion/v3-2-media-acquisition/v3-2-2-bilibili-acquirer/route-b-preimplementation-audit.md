# V3-2-2 路线 B 实施前内部审查

日期：2026-10-06。审查范围：Route B Revision 4 文档、Schema、registry semantic builder、probe identity 修订。产品 Acquirer 尚未实现。

## 1. 结论

`DOCUMENT CANDIDATE / EXTERNAL REVIEW REQUIRED / PRODUCT IMPLEMENTATION NO-GO`

- Fatal：0
- Major：0
- Minor：2

只有独立外部文档审查 Fatal=0/Major=0 后，用户已有的路线 B 授权才允许进入 B-1..B-6 产品实现。

## 2. 规格一致性

| 检查 | 结果 |
|---|---|
| 12 URL 与 6+3+1+1+1 | 保持；未缩分母 |
| 固定锚点 | `BV1ZpYd66ELP` 保留为可审计字幕失败样本 |
| ASR 路线 | 恰好 1 natural + 2 audited failure |
| 真实数据 | 页面/字幕发现/媒体/后续 ASR 均要求真实；仅故障条件受控 |
| 用户体验 | 不新增用户步骤；故障入口不在 UI/API/env |
| 开放架构 | `MediaAcquirer` 保持 portal-neutral；B站知识仅在 plugin |
| V4 边界 | 跨模型质量回退仍在 V4；未回流 V3 |

## 3. 架构与安全审查

1. Revision 4 新增而不是修改 v1/v2/v3，历史证据可复算。
2. Runtime `acquisition/__init__.py` 不导出 Revision 4 fault builder；Runtime API、coordinator、credential transport 和 portal registry 均无 fault 字段或环境变量。
3. `acceptanceFaultScenario` 只作为候选证据输入，由 E2E runner 产生；Schema 固定 `injectionLayer=acceptance_orchestrator` 与 `productionConfigReachable=false`。
4. 两个故障样本必须有真实字幕项和 discovery hash；不能直接跳到媒体。
5. probe 当前 cid 优先级已从集合默认 cid 修正为页面当前 cid，并输出 part identity，避免多 P 误绑定。
6. Cookie、字幕私有 URL、cookiefile、绝对路径均不在 Revision 4 Schema。

## 4. 可执行验证

命令：

```text
cd services/local-runtime
PYTHONPATH=. python3 -m pytest -q \
  tests/test_v3_media_sample_registry_v3.py \
  tests/test_v3_media_sample_registry_v4.py
```

结果：`16 passed`。Revision 3/4 Schema `Draft202012Validator.check_schema` 均 PASS。

负例覆盖：自然探测出现字幕、两次 hash 相同、注入层变为 production、production 可达、无需真实媒体、缺真实字幕发现，均 fail closed。

## 5. Minor

- M-1：自然样本 `BV13W41137qV` 较长，真实下载/后续全长 ASR wall-clock 未在本轮文档审查中实测；资源上限不得放宽。
- M-2：Route B E2E runner 与生产不可达静态审计尚未实现；它们是 B-4 的代码交付，不可用当前 Schema 测试冒充。

## 6. 出门前置

外部审查必须确认：PRD 不再声称 3 个天然无字幕；Fault 不可从生产入口表达；Revision 4 可拒绝缺任一双边证据的候选；12 页与后续 V3-2-3 顺序门禁未被削弱。


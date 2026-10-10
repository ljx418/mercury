# V3-2-0 双模型比较材料机器验收结果

日期：2026-09-18。runId：`v3-2-asr-comparison-20260918T153809Z`。

> 后续状态（2026-09-21）：机器材料 PASS 保持；用户最终人类结果触发 critical=1、neither-acceptable=1，D08 已转为 `FAIL / REPLAN`。下方 `PENDING` 是本机器验收生成时的历史状态，不得作为当前门禁。

## 结论

```text
Comparison material C01..C12: PASS
Machine verifier: 14/14 PASS
Real Chrome UI QA: PASS
Human reviewer A/B + adjudication: PENDING
D08: PENDING
V3-2-0 productionReady: NO-GO
V3-2-1+: BLOCKED
```

## 真实输入与输出

- 样本：`BV1sMNtzJE5B`、`BV1xz4y1S7yF`、`BV1Bb411w741`，均为 P1 固定 `00:30..02:30`。
- 推理：production small + independent base，共 6 次完全离线推理。
- 分桶：3 x 8 = 24 个连续 15 秒 bin。
- bundle SHA-256：`868c2ca3e8be7032501c39e93b6be86be1333b28fb70ec5d45b9b0f17be7d8d0`。
- standalone review page SHA-256：`5e7a577fa94838c993ea8b11396f520112ceab00438d45789cd16ee9da907015`。
- comparison Schema SHA-256：`753c009f8cddb8cdad4b585c61282e5b3e8e10a8eff22389fce5cd6befb2319a`。

## 机器验收

- comparison bundle、独立 review A、独立 review B、adjudication 四类实例均通过 Draft 2020-12 Schema。
- verifier `14/14`：模型字节、3 样本、固定窗口、6 推理、24 bin、A/B 交替、无听写控件、review/adjudication、清理、hash 与 UI QA 全通过。
- 四视口：360/420/768/1280，根横滚 0，24 bin 全部渲染，页面可见文本不暴露模型身份。
- Axe serious/critical=`0/0`；键盘=`3/3`。
- 真实 Chrome 完成 24 项 review JSON 生成、导入两份结果、识别 1 项分歧并生成 24 项 adjudication JSON。
- QA 生成的 `qa-reviewer`、`qa-reviewer-b`、`qa-adjudicator` 只验证交互，不计人类质量签署。

## 隐私与清理

- `cookieFileDeleted/sourceMediaDeleted/audioWindowDeleted/privateWorkDeleted=true`。
- 最终私有 run 扫描：12 files / 422,266 bytes / 26 个 Cookie 原值 0 hit。
- Chrome QA profile 已删除。
- 完整机器 transcript 只在私有 bundle/standalone HTML；公开文档和人工导出 JSON 不含 transcript、Cookie、cookiefile 或绝对私有路径。

## 已修复 QA 问题

1. 底部 sticky 操作栏遮挡单选控件：改为非覆盖式静态操作栏。
2. `file://` + WSL/CDP 自动下载不稳定：页面改为先生成可复制 JSON，再提供显式下载链接；结果生成不依赖下载策略。

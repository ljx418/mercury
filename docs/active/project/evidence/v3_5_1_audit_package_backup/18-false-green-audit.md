# V3-5.1 生产候选假绿审计

日期：2026-10-10。

## 已发现并闭环

`build_ask_benchmark()` 为合同 shape 写入 `criticalMeaningError=false` 与 `citationSupported=true`，通用 semantic verifier 会据此通过。它能证明引用存在和类型闭合，但不能证明语义正确；若直接据此宣称候选 PASS，将构成“生产者自报即质量结论”的 Major 假绿。

闭环方式：生产 verifier 新增独立 `v3-5.1-human-quality-review/v1` 输入。缺提交时即使三候选 Schema、semantic、浏览器结果全绿，也固定输出：

```text
machinePassed=true
humanQualityReviewPresent=false
status=HUMAN_REVIEW_PENDING
passed=false
exitCode=3
```

提交必须逐项覆盖 3 x 12 问与 UX01..UX05，绑定三个候选 SHA-256；篡改任一候选 hash 实测 exit 2。临时自动生成的 Schema 测试 submission 不入仓、不作为人类证据，候选最终状态已恢复为 pending。

## 其他假绿检查

- 0 BiliNote 输出、0 mock frame、0手工转写进入生产候选。
- 30 次 seek 均读取真实 B站 player，五种 origin 各 6 次，无仅点击不回读。
- 24 个截图只作为授权 selected-frame 云输入与私有本地 review artifact；自动化页面截图只哈希后丢弃，公开持久数 0。
- 三候选 task/outline/evidence ID 两两隔离；不跨 run 拼接。
- 公开秘密扫描 0 命中；最终封存前必须在新增审计文件后再扫描一次。

## 当前判定

Fatal=0，Major=0，Minor=1：通用 semantic verifier 仍保留 producer shape 检查，只有 production verifier 才是本候选出门权威。该限制已在 PRD review、human README 与 exit audit 同步声明。

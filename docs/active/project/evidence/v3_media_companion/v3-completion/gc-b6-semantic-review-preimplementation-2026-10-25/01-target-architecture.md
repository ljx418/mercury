# GC-B6 目标架构大纲

## 1. 约束

- B-6 必须审查 B-5 同一 fresh candidate 的真实派生证据，不能事后拼接。
- evaluator 必须看不到 Provider identity，不能以 schema PASS 代替内容正确。
- 公共证据不得包含全文、截图字节、秘密、原始媒体或私有路径。
- B-6 不新增公共 API、schema、FailureCode 或产品状态。
- 所有可见 Chrome 必须 owned、`--mute-audio`，且只在 B6B 获准后启动。

## 2. 组件

```text
Production B-5 task
  -> durable V2.1 derivative
  -> public workspace projection
  -> private evidence metadata files
  -> authenticated thumbnail route
       |
       | after publication, before cleanup
       v
B6ReviewCapture (acceptance harness only)
  -> identity/hash closure validator
  -> private review bundle (0700, outside repo)
  -> evaluator projection (Provider identity removed)
       |
       v
Blind Host Semantic Reviewer (fresh session)
  -> six per-source rubric receipts
  -> one repeated sentinel receipt
       |
       v
B6Aggregate
  -> public scores/codes/counts/hashes only
  -> STAGE B IMPLEMENTATION CANDIDATE
       |
       v
Independent Codex B-7
```

## 3. 私有评审包

每个 source 的私有目录至少包含：

- `artifact.json`：B-5 实际发布的 V2.1 原始字节；
- `workspace.json`：公共 task/revision/source/evidence metadata；
- `evidence.jsonl`：完整派生文本，逐条绑定 evidenceId、kind、时间和
  contentSha256；
- `thumbnails/<evidenceId>.png`：只经产品认证 thumbnail 路由取得；
- `seek-map.json`：章节起点、引用 evidence、最近真实帧和可执行 seek 时间；
- `capture-receipt.json`：来源、artifact/catalog/文件摘要、计数和闭合结果；
- `PRIVATE_MANIFEST.sha256`。

目录由显式 `NAVIA_B6_PRIVATE_ROOT` 提供，必须在仓库外、权限 0700，不得写入
公开 evidence。B7 完成前保留；B7 后或候选失败时按策略清理。

## 4. 身份与完整性不变量

捕获器必须同时证明：

1. derivative、workspace、source receipt 的 taskId/revision/sourceIdentity 一致；
2. registry order/BVID 与 source identity 一致；
3. 按冻结算法重算 evidenceCatalogSha256，等于 derivative binding；
4. derivative 引用的每个 evidenceId 都存在，且 contentSha256 与文本字节一致；
5. 每个 `thumbnailAvailable` frame 都能通过产品路由读取真实 PNG；
6. seek-map 的时间在媒体范围内，章节引用不跨越错误 source/task；
7. capture 发生在 durable publication 后，Runtime/profile cleanup 前；
8. cleanup 仍由原 runner owner 执行，捕获失败必须使 candidate fail closed。

## 5. 盲态 evaluator 视图

Evaluator 可见：从 artifact 投影出的 brief/claims/chapters/quality 语义内容、
派生证据文本、时间戳、evidence ID、缩略图和 seek map。Evaluator 不直接读取
包含 receipt 的原始 artifact。Evaluator 不可见：Provider/model/endpoint、请求/
响应摘要、Cookie、token、文件路径、Runtime DB/profile ref、原始媒体。

Provider receipt 仍由 machine gate 校验，但在 evaluator projection 中被替换为
不可逆 review binding hash。这样保留 artifact 完整性而不暴露模型身份。

## 6. 方案取舍

| 方案 | 结论 | 原因 |
|---|---|---|
| 只审 derivative | 拒绝 | 无法核验 claim-evidence、截图和 seek |
| 清理后重建 R8 evidence | 拒绝 | task-dependent ID 与非确定 caption 无法证明同源 |
| 把全文/截图放进公开 evidence | 拒绝 | 扩大隐私和仓库泄露面 |
| fresh candidate cleanup 前私有捕获 | 采用 | 同源、可闭合、公共面不扩张，代价是再跑一次六视频 |

# V3-2-0a ASR Provider 与模型管理独立实施出门审查请求

日期：2026-09-21。审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`。候选决定：`LOCAL LIMITED PASS / INDEPENDENT EXIT AUDIT REQUIRED`。

## 审查目标

请只读独立验证 V3-2-0a 是否达到：用户可在 Settings 看见资源/质量/请求与生效模型；最低资源 Tiny 可离线兜底；allowlisted 模型可一键安装并显示进度/取消；失败可用 `.navia-asrpack` 恢复；任意 URL/代码/路径和损坏资产 fail closed。

必须同时确认本候选没有把模型安装或 Tiny 自检扩大为 V3-2-A06、MediaTranscript、媒体获取或 V3 PASS。

## 固定分母

逐项审查 `V3-2-0a-A01..A16`，不得 N/A。至少独立执行：

1. Schema Draft 2020-12 meta + positive；审查 negative coverage。
2. catalog model/revision/license/file byte/hash/resource/quality 集合。
3. Runtime 模型管理测试，特别是 404、断线、截断、hash、磁盘、取消、重启、package identity/revision/hash/zip-slip/size/file-count。
4. Extension 不含模型 host/path/download authority；客户端 URL/hash/path/provider/additional property 被拒绝。
5. Small 实际四文件 hash/总字节/file-set hash 与公开结果一致。
6. Tiny manifest、低资源公开结果和私有 result hash binding 一致；确认没有 transcript/audio/Cookie/path 泄漏。
7. 最新 Chrome result `v3-2-0a-2026-09-21T121500382Z` 17/17、5 张截图 hash、四视口、Axe、键盘与 cleanup。
8. Draw.io 8 页、ID/边/边界完整，图文状态一致。
9. 全量 Runtime 287、Extension 293、typecheck/build 证据是否足以支持候选声明。

## 已知 Minor 候选

- M-1：Tiny 发布资产已由脚本生成并校验，但最终安装器/Runtime Docker 发行流程未冻结；不得声称公开发行包已携带权重。
- M-2：Chrome 安装弹窗使用 typed job interception；真实公网下载由独立 Runtime run 覆盖，两者不是同一次端到端请求。
- M-3：Small 保持 `failed_current_gate`，Paraformer/large 保持 qualification-required。

请判断以上是否维持 Minor，或是否存在 Fatal/Major。独立审查通过条件为 Fatal=0、Major=0；结果建议落盘到：

```text
docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/
  v3-2-0a-independent-implementation-exit-audit.md
```

## 决定边界

允许的最大结论：`V3-2-0a LIMITED PASS for local ASR provider/model management and low-resource fallback.`

必须保留：`V3-2-0/A06 FAIL / REOPENED; V3-2-1..7 NO-GO; V3-3+ NOT_IMPLEMENTED.`

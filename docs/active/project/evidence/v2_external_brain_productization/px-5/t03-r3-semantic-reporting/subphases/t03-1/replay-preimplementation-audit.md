# T03-1 T02.3 重放实施前审计

日期：2026-09-14。决定：`GO`。

## 输入与范围

- 唯一正输入：`t02-r2-status-contract-production-input-20260914T001017`。
- raw SHA-256：`7fd641697f508c9e9fb81ab2d3af8a1248b1df61e90c83346617f9b2596266a1`。
- seal：`430207668675497c9a9d5b22f8539ae66537c72a172ed35d18fafe8e28ba8270`。
- snapshot：`98d3a8be12cd168d10993e996a95e1e11e59c184`。
- T02.3 用户授权自审：Fatal 0 / Major 0 / Minor 1；Minor 为同一代理自审，不作为最终独立出门签署。

本阶段只重放 `ArtifactReader` 的 filesystem、artifact 和 Git blob 读取。禁止复用 T02.2 派生结果、修改 sealed raw、跨 run 拼接、读取 `virtual/*` 或运行旧 production 链。

## 验收门槛

1. T03-0 合同回归先通过。
2. 正输入的所有采用 artifact path/hash/length 可重算。
3. snapshot commit 的三个 scan root 可读取。
4. repo root、脚本目录、临时 cwd 的 reader 结果等价。
5. 绝对路径、遍历、symlink escape、缺文件与 hash mismatch 继续 fail closed。

Fatal 0，Major 0。允许执行 T03-1 replay；不提前放行 T03-2 或 T03-4。

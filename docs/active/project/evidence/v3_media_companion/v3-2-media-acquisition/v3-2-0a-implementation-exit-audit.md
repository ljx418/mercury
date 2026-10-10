# V3-2-0a 实施出门内部审计

日期：2026-09-21。性质：实现代理内部只读复核；不替代不同 session 独立审查。

## 0. 决定

`V3-2-0a LOCAL LIMITED PASS / INDEPENDENT EXIT AUDIT REQUIRED`。

Fatal=0，Major=0，Minor=3。V3-2-0/A06 仍 `FAIL / REOPENED`；V3-2-1..7、V3-3+ 仍 `BLOCKED / NOT_IMPLEMENTED`。

## 1. 已复核事实

- A01-A16 均有实际机器、真实 Chrome 或真实数据证据，无 N/A。
- Runtime 287、Extension 293、ASR targeted 17、typecheck、build 全通过。
- Small 官方真实安装 `486,212,372` bytes；四文件 hash 与 catalog 一致；本地模型 load、自检、原子发布、重启选择通过。
- Tiny 在 8-core affinity、8 GiB 地址空间、无 GPU 下处理用户授权真实 B站 30 秒音频，17 timestamped segments，峰值 RSS 350200 KiB；原始媒体与规范化音频均删除。
- 最新真实 Chrome run `v3-2-0a-2026-09-21T121500382Z` 为 17/17，result SHA-256=`397993e07fec2e3a5260c3ba42df3d52d3cb9ca7ff2566c949e86950b3521901`；5 张 PNG 可解码，Axe blocking 0，键盘与焦点通过。
- 公开证据 Cookie/Authorization/绝对路径扫描 0 hit；Extension 无模型源 URL 或直接下载逻辑。
- Draw.io 保持 8 页，结构异常 0，并明确 A06 失败和后续阻塞。

## 2. 风险闭环

- 官方模型实际重定向到 `us.aws.cdn.hf.co`，旧 allowlist fail closed。实现仅增加 `.cdn.hf.co` 官方后缀并测试伪装域名 `*.cdn.hf.co.attacker.invalid` 仍拒绝。
- 原 A10/A11 回归缺 404/断线/截断/磁盘与包 identity/revision/hash/上限。补强后模型管理测试由 10 增至 17，全部通过。
- Workspace 既有空 `role=list` Axe critical 已在本子阶段前置修复并由 768/1280 回归确认 blocking 0。

## 3. Minor

- M-1：Tiny 已由固定脚本生成、hash 验证并作为候选 bundled root 实跑，但 Navia 尚无冻结的最终安装器或 Runtime Docker 发行流程；不得声称公开发行包已经携带权重。
- M-2：Chrome E2E 的安装弹窗 transport 使用 typed job interception；真实公网下载生命周期由独立 Runtime run 覆盖。两类证据互补，但不是同一次 browser-to-network E2E。
- M-3：Paraformer/large 仍 qualification-required；Small 仍 failed-current-gate。Provider 开放性已建立，不代表新增模型质量已通过。

## 4. False-green 结论

没有降低 A06、补造第二 reviewer、跨 run 拼接质量结论、把 Tiny 计 production、暴露 Cookie/音频正文/路径，或把 UI job interception 称为真实公网下载。当前可提交独立审查，但在独立审查 Fatal=0/Major=0 前不得升级为 V3-2-0a 最终 LIMITED PASS。

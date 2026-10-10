# V3-2-0a ASR Provider 与模型管理本地验收结果

日期：2026-09-21。状态：`LOCAL LIMITED PASS`。独立实施出门审查 `Fatal=0 / Major=0 / Minor=3`，见 `v3-2-0a-independent-implementation-exit-audit.md`。固定分母 `V3-2-0a-A01..A16` 无 N/A。

| ID | 实际结果 | 证据 | 结果 |
|---|---|---|---|
| A01 | Draft 2020-12 Schema meta PASS；positive 0 error；shape negatives 被拒绝 | `test_public_contract_schema_and_negative_shapes` | PASS |
| A02 | Tiny 固定四文件共 78,203,619 bytes；prepare script 校验并发布到候选 bundled root；Runtime 首次读取为 ready | bundled manifest SHA-256 `b6713f1f...2afb` | PASS（发行物接入见 M-1） |
| A03 | Settings 显示 requested/effective/fallback、质量和 CPU/RAM/VRAM/磁盘 | Chrome 360/420 screenshots | PASS |
| A04 | ready Small 选择后 Runtime 重启仍为 requested/effective Small | real install restart probe + pytest | PASS |
| A05 | 未安装 Small 时 requested=Small、effective=Tiny、原因可见 | pytest + Chrome | PASS |
| A06 | Small 只从 immutable catalog 获取；官方 CDN 重定向逐跳校验；伪装域名拒绝 | real install run + allowlist tests | PASS |
| A07 | 真实 job 记录 486,212,372 bytes、速度、ETA、sequence；UI 显示阶段与取消 | real install state + Chrome modal | PASS |
| A08 | 四文件 byte/hash 全匹配，本地 load self-test，原子发布 ready | `v3-2-0a-real-install-result.json` | PASS |
| A09 | 下载取消进入 cancelled，staging 清理，Tiny 保持 effective | pytest | PASS |
| A10 | 断线、404、截断、hash、磁盘和重启注入均 failed/corrupt；无模型发布 | 17 项模型管理 pytest | PASS |
| A11 | 正确 `.navia-asrpack` 成功；错误 model/revision/hash、zip-slip、体积和文件数均拒绝 | pytest | PASS |
| A12 | Tiny 禁卸载；卸载当前 Small 后 requested/effective 明确切回 Tiny | pytest | PASS |
| A13 | Extension 不含模型源/目录访问；客户端 URL/hash/path/additional properties 被拒绝 | static scan + API pytest | PASS |
| A14 | 8 cores、8 GiB 地址空间、无 GPU，Tiny 对真实 B站 30 秒音频输出 17 段；峰值 RSS 350200 KiB | `v3-2-0a-low-resource-real-data-result.json` | PASS |
| A15 | 最新 Chrome 17/17；四视口无根溢出；5 个视图 Axe blocking=0；键盘取消/焦点返回/chooser 通过 | run `v3-2-0a-2026-09-21T121500382Z` | PASS |
| A16 | Tiny/Small/qualification 文案与 PRD 边界正确；公开材料 secret/path scan 0 hit | PRD review + internal audit | PASS（待独立审查） |

## 回归

- Runtime：`287 passed`。
- ASR 模型管理：`17 passed`。
- Extension：`39 files / 293 passed`。
- typecheck：exit 0。
- WXT production build：exit 0；只有既有 chunk size warning。
- Draw.io：8 页 / 113 vertex / 54 edge / 0 duplicate ID / 0 missing edge ref / 0 overflow。

## 证据边界

Chrome 安装弹窗使用 typed installation job transport 验证浏览器 UI 合同；真实公网下载、逐字节进度、官方 redirect、hash、自检、原子发布和重启由单独 Runtime run 验证。两者不是同一次端到端请求，不能合并冒充。旧 Chrome runs 保留历史；`121500382Z` 是当前权威候选。

Tiny 和 Small 的安装/运行不改变 V3-2-A06 失败。V3-2-1..7 保持 BLOCKED。

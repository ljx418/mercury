# V3 Media Companion 文档准备度审计

> 历史边界：本文件记录 V3-0/V3-1 Route A 文档冻结时点，不是当前 V3-2 门禁权威。V3-1.3 已在后续独立实施审查中 PASS；当前状态以 `stage-gates/v3-media-companion.md` §11-12 和 `evidence/v3_media_companion/v3-2-media-acquisition/v3-2-internal-document-audit.md` 为准。

状态（历史）：`V3-1 ROUTE A INTERNAL DOCUMENT PASS / EXTERNAL REAUDIT REQUIRED / PRODUCT CODE NO-GO`
日期：2026-09-17

## 1. 审计目标与边界

验证 V3 文档候选能否无歧义指导 `V3-1..V3-7` 自动化开发，并拒绝把 V2/PX-6、mock、静态原型、BiliNote 输出或无证据模型内容计为 V3 生产通过。本轮按用户 2026-09-16 决策把受控 Cookie 会话改为主路径，公开/页内字幕与可信 `tabCapture` 保留为回退。本轮只验证规格、合同、图纸和交互原型，不证明媒体产品能力已实现。

先前 `document-freeze/independent-document-audit.md` 审查的是 no-cookie 候选，结论保留为历史记录但不能覆盖本次路线修订；必须对重建后的平铺包重新独立审查。

## 2. 权威范围同步

| 项目 | 结果 |
|---|---|
| V2/PX-6/RKM 暂停且未完成，V3 优先，V4 承接知识能力 | PASS |
| B站首发；`BV1ZpYd66ELP` 为锚点；YouTube 后置 | PASS |
| 首版包含受控 Cookie 会话主路径、公开字幕/tabCapture 回退、本地 ASR、关键帧、本地 OCR、授权云端 VLM | PASS |
| Side Panel / Media Workspace 双容器职责与 8 条 route | PASS |
| 五项产品授权、每任务 credential lease 与 fallback capture grant 分离 | PASS |
| Cookie 值仅在浏览器/内存/任务期 `0600` 文件，0 持久化/日志/公开证据 | PASS |
| 可选窄域权限、Cookie 名称白名单、认证 loopback 一次性 envelope | PASS |
| `VideoOutline` 单一事实源、Ask/evidence/jumpback 同 task | PASS |
| `MediaTaskStore`、本地导出与 `deferred_to_v4` | PASS |
| 12 个唯一 URL 的互斥分母与 V3-1 前注册表冻结条件 | PASS |

未发现 active 文档仍把 H01/data_service 设为 V3 前置，或把本地 OCR/授权 VLM 延后到 V3.x。历史 `V3.0-*` 只以“已废止”说明保留，不再作为实施输入。

## 3. 机器检查（路线 A 当前候选）

### 3.1 合同与负例

- Draft 2020-12 meta-validation：PASS。
- positive root：1/1 PASS，`evidenceClass=contract_fixture`。
- registry/case：25/25，`requirementId/requirementKey/enforcementLayer/failureCode` 精确相等。
- Schema negatives：5/5 被 Schema 拒绝。
- Semantic negatives：20/20 变异后仍 Schema-valid，并由开发/验收计划 §9 的确定性算法绑定唯一失败码。
- Portal registry：1/1 通过闭集、路径、权限、能力和身份映射检查；仅 `bilibili` 为 active adapter，YouTube/小红书只作为未来扩展示例。
- 生产防线：`contract_fixture`、mock Provider、原型路径、fixture 路径或跨 run artifact 不得支持生产声明。

### 3.2 Draw.io

- 8 页中文；113 vertices；53 edges。
- 每页 ID 唯一；0 broken edge reference；0 图元越出 1600x900。
- 页面同时覆盖目标体验、当前/目标代码实体、双容器、媒体管线、任务/证据、BiliNote 治理、里程碑、自动验收、人类验收和 No-Go。

### 3.3 交互原型

- bundled Chromium 缺少 `libnspr4.so` 的失败保留为历史基础设施记录；本轮改用 Windows 系统 Chrome 152，经 CDP 和仓内 Playwright 1.60.0 完成新鲜复验，不把旧 no-cookie 结果继承到当前候选。
- 360/420 Side Panel 和 768/1280 Workspace 均为 0 横向溢出；键盘授予、可信 capture 停点、Workspace、Ask 和 H01-H10 回填可操作。
- Axe violations/serious/critical 为 0/0/0，console/page error 为 0/0；结果落盘于 `prototype-qa-results.json`。
- 自包含页面内联真实 Mock 基线、四张逐步操作图和 Lucide，无外部 `src`/`href`；隔离浏览器实测可从可信回退进入 Workspace。
- 原 AI 样张因视频和模块事实错误已从权威页面移除；确定性 HTML/CSS 是目标总体设计、模块设计和交互权威，所有示例继续标明非生产证据。

### 3.4 BiliNote 参考边界

- `v3-bilinote-migration-allowlist.json` 使用 default-deny、clean-commit 和 reference-only 策略。
- MIT LICENSE 与六个允许研究文件均从 `be3889395afb5346aa4339ae933d3ba2e08f25a8` 原始字节独立重算，SHA-256 和 byteLength 全部匹配。
- 当前本地 BiliNote 工作树为 dirty；策略明确拒绝这些字节。V3-0 未授权复制任何上游代码。

## 4. 内部多轮审计

第一轮发现 4 个 Major 和 2 个 Minor，全部修复并记录于 `internal-document-audit-round1.md`。第二轮从缩分母、Mock、授权、清理、路由、Ask、反跳、V2/V4 污染和 BiliNote 迁移攻击候选，修订后 Fatal=0、Major=0、Minor=0。Cookie 主路径初次变更记录于 `cookie-primary-route-internal-audit-2026-09-16.md`，其中浏览器基础设施 Minor 已由第三轮系统 Chrome 新鲜 QA 关闭。

第三轮 `internal-cookie-visual-audit-round3-2026-09-17.md` 关闭真实 Mock 基线、AI 图事实污染、可信 capture 停点、自包含脚本和 420 截图五类问题。第四轮 `internal-security-false-green-audit-round4-2026-09-17.md` 复算合同、clean-commit 白名单并攻击凭据、清理、缩分母、Mock、跨 task、V2/V4 和整仓迁移假绿路径。两轮均为 Fatal=0、Major=0、Minor=0。

关键文件 SHA-256：

```text
02b363327501da22f4293f6bfd7f1bee946bfda84ac56d8721d3c21c8b7bee73  v3_media_companion_contracts.schema.json
4c3a21037d1c6199e9bd968ed51b9741884d655f96ce1aa3a4bc6b1b5f60bce6  v3-media-portal-registry.json
e05c72f0339084c4b9db5a36c45edc1032a8be5b4a40d5a96a19e2622cfc36ad  v3-media-companion-contract-fixtures.json
27e03b1bbc2df36546b65cdf811b47252b96164c9c5aec1b54820c5aacd6ca91  v3-media-companion-prototype-self-contained.html
4efed988b1c18cf1262f1753db5dc5f1706ceee328f0e5238ad9bf279696f5cf  v3-media-companion-gap.drawio
05f924826fa91e3c6d740187ba1badb3923a38d7ac29744fa4529bf67061cf41  v3-bilinote-migration-allowlist.json
4836ae763ea08ffa9b0bc64aa9f452ee2676dc3e91933cef68eee2f4cb97d547  prototype-qa-results.json
1f724e90fe5163fe1beca4acd785a279e9aea229e62aa1e2c1dc1f233483f499  internal-cookie-visual-audit-round3-2026-09-17.md
0f2e1c8e06e5ca8f91005ec71a5c03d24bebfa00c5424ac2c522f08ee222cbe5  internal-security-false-green-audit-round4-2026-09-17.md
3377a575712f7c56239372cfcb93d0f0f18faa07d2cc696c984aec910dfc366d  internal-document-audit-round1.md
00d20e3bd8a88484a6990de15dbe814bfc6915edc46c6238e53e6372fb209aeb  internal-document-audit-round2.md
```

## 5. 残余实现风险

B站 Cookie 名称/接口/风控变化、Chrome 可选权限、yt-dlp 与平台兼容性、Chrome capture 回退、本地 ASR/OCR 性能、真实 VLM 成本和输出质量只能在后续真实实现阶段验证。文档已为这些风险设置短租约、真实 Chrome、真实 Provider、预算、清理、blocked/fallback 和停机门禁，未将其误报为已解决。

## 6. 结论

内部结论：Fatal=0，Major=0，Minor=0。路线 A 文档候选在规格、视觉原型、开放门户适配合同、BiliNote 参考边界和假绿拒绝方面足以提交 Claude Code CLI 独立文档复审。该结论不代表 B站平台兼容性、YouTube/小红书适配或 V3 产品功能已实现。

当前门禁：

```text
V3-1 Route A internal document readiness: PASS.
V3-1 Route A external independent document re-review: PENDING.
V3-1..V3-7 product implementation: NO-GO.
V2/PX-6/RKM: PAUSED / INCOMPLETE.
```

用户已批准按路线 A 推进；只有本次外部独立复审 Fatal=0/Major=0，才能改为 `V3-1 IMPLEMENTATION GO`。

## 7. 2026-09-17 路线 A 与开放门户接口重冻结

用户已选择路线 A：B站详情页窄域自动桥接；普通网页 action/command + `activeTab` + 原生 Side Panel；禁止 `<all_urls>` 和等价全站静态匹配。为避免未来 YouTube、小红书复制 B站合同，新增 `MediaPortalAdapter`、构建期 `MediaPortalRegistry`、通用 `MediaPageContext`、`PortalCredentialLease` 和机器注册表 `contracts/v3-media-portal-registry.json`。

本次合同升级为 Schema v3 / fixture v3：25 项 registry/case，5 schema + 20 semantic；新增 adapter binding 与 source identity 两项 semantic 防线。机器复算结果为 Schema meta PASS、positive 0 errors、25/25 集合一致、5/5 schema invalid、20/20 semantic Schema-valid。Draw.io 仍为 8 页，0 重复 ID、0 越界、0断边。

两轮新内部审计：

- `evidence/v3_media_companion/v3-1-page-session-baseline/route-a-internal-architecture-audit.md`：Fatal=0/Major=0/Minor=0。
- `evidence/v3_media_companion/v3-1-page-session-baseline/route-a-internal-contract-false-green-audit.md`：Fatal=0/Major=0/Minor=0。

当前哈希：

```text
02b363327501da22f4293f6bfd7f1bee946bfda84ac56d8721d3c21c8b7bee73  v3_media_companion_contracts.schema.json
4c3a21037d1c6199e9bd968ed51b9741884d655f96ce1aa3a4bc6b1b5f60bce6  v3-media-portal-registry.json
e05c72f0339084c4b9db5a36c45edc1032a8be5b4a40d5a96a19e2622cfc36ad  v3-media-companion-contract-fixtures.json
4efed988b1c18cf1262f1753db5dc5f1706ceee328f0e5238ad9bf279696f5cf  v3-media-companion-gap.drawio
```

当前结论：路线 A 内部文档候选 Fatal=0/Major=0/Minor=0；由于权威文件已改变，先前 V3-0 外审只作历史记录。必须重建平铺包并由独立 reviewer 复审后，才能开始 V3-1.1 产品代码。

## 8. 2026-09-22 V3-2-0b 低资源 ASR 资格恢复增量

V3-2-0 的真实人类结论继续为 `FAIL / REPLAN`，V3-2-0a 只保持 `LOCAL LIMITED PASS`。本轮新增 V3-2-0b 文档候选，以官方 FunASR llama.cpp、Paraformer Q8 和 FSMN-VAD 在 8 cores/8 GiB/no-GPU 分母下重新挑战原三个样本，不修改 24 bin、双 reviewer=48 判断或质量阈值。

已完成：PRD/架构/开发/验收/Stage Gate 回写；18 requirement/18 negative case；候选资产与资源 disclosure manifest；8 页 Draw.io 原位更新；带真实基线截图的自包含互动原型；四视口、Axe、键盘和安装/取消/回退 QA；两轮内部文档审查。第一轮 3 Major/3 Minor 已闭环，第二轮为 Fatal=0/Major=0/Minor=3。

后续实施结论（2026-09-22）：文档外审与用户授权后已完成官方资产、Provider、Settings 和低资源真实三样本。sample 03 / bin 2 在 120 秒长窗中产生 0 segment，但 PCM16 RMS=1948；机器在人工盲评前 fail closed。修复后的失败证据 run 为 `v3-2-0b-5.1-20260922T072602Z`，8/8 verifier PASS 只证明失败可审计，V3-2-0b 总体仍 `FAIL / REPLAN`。

状态传播闭环（2026-09-22）：5.1b 权威 run `v3-2-0b-5.1b-20260922T084116Z` 以真实官方资产、Runtime 和 Chrome 完成 16/16 E2E；Settings 明示红色“已安装 · 质量未通过”，Paraformer 仍不可选，effective model 保持 Tiny。该结论只证明产品没有掩盖失败，不恢复 A06。

单独截取同一 15 秒 bin 后模型可输出 1 segment/28 字符，因此推荐统一固定 15 秒预切片作为新候选，而不是降低质量阈值或立即更换高资源模型。该路线会改变生产推理合同，需重新冻结和外审；V3-2-1..7、媒体获取和生产 transcript 继续阻塞。

## 9. 2026-09-22 V3-2-0b-5.3 路线 A 文档候选

用户已授权路线 A 文档与实施阶段。新增 `FixedWindowAsrOrchestrator`、FW01..FW20 固定门禁、20 requirement/20 negative cases、3 source/24 chunk lineage、每样本 <=2x 延迟门槛、原子 attempt/cleanup 及门户无关边界。独立文档审查为 Fatal=0/Major=0；5.3-0..4 已完成，20/20 负例、38/38 专用测试和 330/330 Runtime 回归通过。

真实 run `v3-2-0b-5.3-20260922T110455Z` 中 sample01/02 完成 8/8 且 wall time 8240/8380ms；sample03/chunk4 `60000..75000ms` 在 RMS=1498.877、239852/240000 非零帧下输出 0 segment。关闭 VAD和调整 `vad-maxseg` 仍为空；20/30 秒上下文仅是诊断，因时间归属与重复文本风险不能拼入候选。当前 `V3-2-0b-5.3 FAIL / REPLAN`，5.3-6/7 与 V3-2-1..7 BLOCKED，Paraformer 不可选择，Tiny fallback 不变。

## 10. 2026-09-22 V3-2-0c 路线 C 最小 Spike

路线 C 文档已冻结并完成内部实施审计。官方 SenseVoiceSmall Q8 的 repository/revision/bytes/SHA/license、FunASR Runtime tag/source commit/archive/binary 和 FSMN-VAD 均已绑定。真实 run `v3-2-0c-spike-20260922T131329Z` 在 8 cores/8 GiB/no-GPU/seccomp 断网边界下对已知遗漏窗口及两个控制窗口得到 3/3 非空合法 SRT，资产与资源均未超限。

结论限定为 `SPIKE_FEASIBLE / PRODUCTION NOT QUALIFIED`。三窗均只有近整窗单 segment，且没有 24-bin/双 reviewer/Settings/跨平台证据，因此路线只可进入 production candidate 文档与外部审查；V3-2-A06、V3-2-1..7 继续 BLOCKED。

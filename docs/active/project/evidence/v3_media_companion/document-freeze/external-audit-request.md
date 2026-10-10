# V3 Media Companion 外部独立文档审查请求

日期：2026-09-17
审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`
建议落盘：`docs/active/project/evidence/v3_media_companion/document-freeze/independent-cookie-primary-document-audit.md`

## 1. 决策对象

请判断当前 V3-0 Cookie 主路径修订候选是否可以在用户另行明确授权后，无歧义支撑 `V3-1..V3-7` 自动化产品开发与真实验收。此前 `independent-document-audit.md` 审查的是 no-cookie 候选，只作历史记录，不得作为本次路线的 PASS。

本次只能审查文档、合同、交互原型和图纸。V3 产品代码仍 `NOT_IMPLEMENTED`；不得把本包、原型、contract fixture、BiliNote 能力或既有 V2/PX-6 代码升级为 V3 产品通过。

## 2. 必须独立复核

1. 重算 Manifest 的 18 个 payload SHA-256，并与权威源路径逐字节对账。
2. 对 `12-contract.schema.json` 执行 Draft 2020-12 meta-validation，并验证 `13-contract-fixtures.json` 的 positive root。
3. 独立执行 23 个变异：5 个 Schema case 必须 invalid；18 个 semantic case 必须保持 Schema-valid；registry/case 的 ID、key、layer、failureCode 必须精确相等。
4. 审查开发/验收计划 §9 的语义算法能否确定性拒绝 18 个 semantic case，以及 `contract_fixture` 是否会被 production validator fail closed。
5. 解析 `10-gap.drawio`：恰好 8 页、中文、页面 ID 唯一、边引用完整、图元不越出 1600x900；抽查状态色和具体代码实体。
6. 打开 `08-prototype-self-contained.html`，检查真实 Mock 阻塞基线、四张逐步操作截图、双容器分工、三种采集情景、可信 capture 停点、Workspace/Ask/反跳/回填交互、四种目标宽度和“目标示例”边界；确认没有 AI 样张或原型结果冒充产品事实。
7. 对账 PRD、架构、根开发/验收计划、详细计划、Stage Gate、组件路由、风险 ADR、BiliNote 研究和图纸，查找仍然 active 的范围冲突。
8. 攻击假绿：重复 URL 缩分母、标题冒充转录、mock VLM、静态截图冒充视觉证据、授权替代同 task 租约、tabCapture 无可信 grant、Cookie 值落盘/日志/公开证据、跨任务复用、无租约下载、绕过平台限制、临时媒体残留、缓存冒充恢复、Ask 无引用、seek 不回读、V2/V4 污染、跨 run 拼接。
9. 独立读取 `18-bilinote-migration-allowlist.json`：从 BiliNote clean commit `be3889395afb5346aa4339ae933d3ba2e08f25a8` 重算 MIT LICENSE 与六个允许研究文件的原始字节 hash/长度；确认 default-deny、dirty diff 禁止、`reference_only` 和 `copyAuthorization=not_authorized_in_v3_0`，拒绝明文 Cookie 配置和整仓桥接。
10. 评估 V3-0 只冻结 12 页分母/注册表合同、V3-1 实施前再真实探测并冻结 12 个具体 URL，是否消除了循环依赖且未降低验收分母。

## 3. 重点问题

- V3 首版受控 Cookie 会话主路径、公开/页内字幕与可信 tabCapture 回退、本地 ASR、关键帧、本地 OCR、授权云端 VLM 是否在所有 active 文档中一致？
- Chrome `cookies`/host permission 是否最小化且无 `<all_urls>`；Cookie 名称白名单是否封闭；一次性 `BilibiliCredentialEnvelope` 是否只经认证 loopback 且 request body 不记录/重放；`BilibiliCredentialLease` 是否不含秘密；任务终态能否确定性证明 cookiefile、临时媒体、原始音频和非证据帧均清理？
- Side Panel、Media Workspace、Runtime、A/C/D、MediaTaskStore 和 V4 Adapter 的职责是否明确且无平行权威？
- 8 route × direct-open/reload/Back/reopen、四视口、Axe/Keyboard、真实 Provider、真实 seek 和 H01-H10 是否有具体操作与出门条件？
- 确定性 HTML 是否足以作为交互设计权威；原 AI 图被移除后，是否仍完整覆盖当前基线、目标总体设计、详细模块、用户路线和人类回填？
- 是否仍存在需要实施者自行决定的字段、失败码、状态、分母、路径、授权、清理或证据等级？
- 文档完成后是否足以先制定 V3-1 独立开发/验收计划，而不提前承诺 V3-2..V3-7 已实现？

## 4. 输出要求

请按 Fatal、Major、Minor 列出文件/章节、复现或推导、影响和最小修复。最后明确给出以下之一：

```text
V3-0 DOCUMENT PASS / V3-1 IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION
```

或：

```text
V3-0 FAIL / REOPENED
```

即使文档 PASS，也必须保持 `V3-1..V3-7 NOT_IMPLEMENTED`，不得扩大为 V3 产品、全平台、直播、无限期/跨任务下载、绕过平台限制、跨视频 RAG、V4 或完整 Monica/BiliNote parity 已完成。

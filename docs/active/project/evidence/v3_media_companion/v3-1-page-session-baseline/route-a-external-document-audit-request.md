# V3-1 路线 A 开放门户架构外部文档审查请求

日期：2026-09-17
审查性质：产品代码实施前的独立只读文档审查。
阅读入口：`AUDIT_MANIFEST.md`，随后按编号阅读 `01-audit-request.md` 至 `19-route-a-false-green-audit.md`。

## 1. 决策对象

请判断当前候选是否可以从：

```text
V3-1 Route A document candidate / product code NO-GO
```

升级为：

```text
V3-1 Route A implementation GO，允许从 V3-1.1 开始按子阶段实施
```

用户已经明确选择并授权路线 A：

- B站视频详情页仅在 `https://www.bilibili.com/video/*` 使用窄域静态页面桥接与同范围 WAR；
- 普通网页仅在 action/command 用户手势后通过 `activeTab` 打开原生 Side Panel；
- B站会话能力单独请求可选 `cookies` 与 `https://*.bilibili.com/*`，不与页面桥接权限混淆；
- 禁止 `<all_urls>`、`http://*/*`、`https://*/*` 及其他等价全站静态注入；
- 使用 `MediaPortalAdapter` 与构建期封闭 `MediaPortalRegistry` 保留未来 YouTube、小红书等门户的扩展能力，但不得把它们声明为已实现。

## 2. 必须独立复算

1. 对 `AUDIT_MANIFEST.md` 的 19 项载荷逐字节重算 SHA-256，并确认权威源路径与平铺副本一致。
2. 对 Schema v3 执行 Draft 2020-12 meta-validation；验证 positive instance 为 0 errors。
3. 验证 25 项 requirement registry 与 25 个 negative case 的 ID、key、enforcement layer 和 failure code 精确映射。
4. 实际应用全部变异：5 个 Schema case 必须被 Schema 拒绝；20 个 semantic case 必须保持 Schema-valid，不能用 Schema 偶然拒绝代替 semantic validator。
5. 重算 `15-portal-registry.json` 原始字节 SHA-256，并确认 positive instance 中 `portalRegistryArtifact.sha256` 完全一致。
6. 审查 registry 是构建期封闭集合、remote adapter 禁止、仅 B站 adapter 启用，YouTube/小红书明确为未实现示例。
7. 审查 manifest/registry/PRD/架构的权限语义，拒绝全站 wildcard 的字符串改写或语义等价绕过。
8. 审查通用 `MediaPageContext`、`PortalCredentialLease`、source identity 和 UI/Runtime 边界是否仍泄漏 B站专有字段或迫使未来门户复制 B站逻辑。
9. 解析 Draw.io XML：必须恰好 8 页、中文、无重复 ID、无断裂 edge reference、无越界；页面需覆盖当前/目标实体、数据流、里程碑、真实验收与 No-Go。
10. 对照 PRD、交互 PRD、架构、开发计划、验收计划、stage gate、V3-1 子阶段计划，检查是否存在范围冲突、缩小真实分母、Mock 假绿或将未来门户误报为已交付。

## 3. 重点攻击路径

- 用 `http://*/*` + `https://*/*` 替代 `<all_urls>`；
- 在代码 import graph 注册未进入机器 registry 的 adapter；
- 将 B站 `adapterId` 改为 YouTube 但保留其 Cookie policy；
- 让 UI、通用 Runtime 或 task contract 直接依赖 `bvid/cid`；
- 修改 context 后保留指向另一视频的 `sourceIdentity`；
- 仅检查 `adapterId=bilibili` 字符串，不校验 revision、platform、matches、capabilities 与 implementation target；
- 使用 contract fixture、V3-1P 探测结果或静态原型冒充 V3-1 产品证据；
- 将普通网页取消常驻 launcher 的明确 UX 变更隐藏为无回归。

## 4. 输出要求

上一轮独立审查仅发现 Minor M1：`status=enabled_v3_primary` 可能被误解为已上线。本候选已将其收敛为 `status=v3_primary_target_unimplemented`，并同步重算 portal registry 与 fixture 原始字节绑定。请同时验证该修复没有改变路线 A 的语义或造成新的 hash/合同不一致。

请将本轮结果保存到：

```text
docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline/independent-route-a-document-audit-round2.md
```

报告至少包含：

- Fatal / Major / Minor 分级及逐项依据；
- 19 项载荷哈希复算结果；
- Schema、positive、25 个 negative case、portal registry 和 Draw.io 的机器复算结果；
- 路线 A 权限与普通网页 UX 变化是否在全部权威文档一致；
- 开放门户接口是否足以支持后续独立适配 YouTube/小红书，同时没有过度承诺；
- 明确门禁原话：`GO` 或 `NO-GO`，以及允许进入的最小下一阶段。

## 5. 工作约束

- 只读审查，不修改主工作树、产品代码或权威文档。
- 不运行旧 PX/V2 generator 或 production validator，不覆盖任何历史 evidence。
- 不把用户实施授权替代为审计通过；Fatal 或 Major 非零时必须保持产品代码 NO-GO。
- Minor 可以不阻断，但必须说明进入 V3-1.1 前还是实施后关闭。

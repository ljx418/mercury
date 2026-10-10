# V3-2-0b 外部独立文档审查请求

日期：2026-09-22。请从外部审计包的 `AUDIT_MANIFEST.md` 开始，独立重算全部载荷 SHA-256；不要信任候选自报结果。

## 审查目标

判断 V3-2-0b 文档是否足以支撑低资源中文 ASR Provider 资格恢复，同时不降低 V3-2-A06、不开启 V3-2-1..7、不把安装成功误写成质量通过。

## 必查项

1. Schema meta、candidate instance、18 registry 与 18 negative case 集合。
2. production candidate 是否可被合同表达；`passed=true` 是否拒绝 43/48、critical=1、unique keys=47 和重复 review hash。
3. 两份 review 是否必须为不同 reviewer/hash，48/24 唯一键是否由 semantic validator 从原始 review 重算，adjudication 是否不能缩小分母。
4. runtime/model/VAD 的 revision、bytes、SHA-256、license、remote-code 和低资源边界是否闭合。
5. Provider 与 B站/YouTube/小红书 portal 是否解耦；权限/PASS 是否不会跨门户继承。
6. 原型是否含真实基线、交互组件、资源影响、安装/取消/离线恢复、盲评和人类回填；四视口、Axe、键盘证据是否可复核。
7. Draw.io 是否保持 8 页、中文、无重复 ID/断边/越界，且状态颜色没有把未实现实体标成已实现。
8. PRD、架构、开发、验收、Stage Gate 是否一致保留 `IMPLEMENTATION NO-GO` 与 V3-2-1..7 BLOCKED。

## 期望输出

请给出 Fatal/Major/Minor、逐项复现与最小修订建议，并明确二选一：

- `V3-2-0b DOCUMENT PASS / IMPLEMENTATION REQUIRES EXPLICIT USER AUTHORIZATION`
- `V3-2-0b DOCUMENT FAIL / REPLAN`

审查结果建议落盘到 `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0b-independent-document-audit.md`。不得运行产品代码、下载模型或把文档 PASS 扩大为实现 PASS。

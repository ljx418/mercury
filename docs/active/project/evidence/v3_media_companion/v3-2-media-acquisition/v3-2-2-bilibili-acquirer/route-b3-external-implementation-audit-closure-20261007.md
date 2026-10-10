# V3-2-2 Route B3 外部实施审查闭环

日期：2026-10-07。

## 1. 独立结论

权威报告：`route-b3-independent-implementation-exit-audit-20261007.md`。

- 门禁：`V3-2-2 Route B3 LIMITED PASS`。
- Fatal：0。
- Major：0。
- Minor：3。
- 唯一放行动作：V3-2-3 实施前恢复文档与审计。

独立审查复算了 19/19 审计载荷、18 个被封文件及 canonical seal、Revision 5 Schema/instance、12 行分母、动态 `1 runtime_no_subtitle + 2 audited_subtitle_failure = 3 media fallback`、B3-01..B3-20、生产故障不可达、公开秘密扫描和旧 run 隔离。

## 2. Minor 处置

| ID | 处置 | 后续约束 |
|---|---|---|
| M-1 | 接受为非阻断 verifier 粒度问题 | 下一次 V3-2-3 runner 必须把 credential/session 负例与 arbitrary URL/adapter/redirect 负例拆成不同 assertion ID，不再复用一个聚合 exit code |
| M-2 | 接受为非阻断扫描计数口径问题 | 后续 verifier 明确 `filesScannedExcludingSeal`，生成 seal 前后不得共用模糊 `files` 字段 |
| M-3 | 接受为独立复算限制 | Cookie 值只在私有运行时扫描；公开审计继续复算 forbidden-context，禁止把真实 Cookie 复制进审计包来追求可复算 |

三个 Minor 均不得通过降低 secret、cleanup、负例或真实数据门槛来“关闭”。

## 3. 后继输入边界

- B3 公共 run 只证明三个能力槽位获得真实媒体及其 hash/shape，不保留可供转写的私有音频。
- V3-2-3 必须在全新单次 lineage 中，从三个固定能力槽位重新执行 acquisition，并在同一 task-private sandbox 内立即执行 SenseVoice；三个样本不得跨 run 拼接。
- `v3-2-route-b3-20261007T014759Z`、旧 Revision 1..4 run 及其 seal 全部保持只读。
- 人工验收保持推迟到 V3-5；V3-2-3 不请求人类听写。

## 4. 禁止扩大

本闭环不代表 V3-2-3、V3-2、视频理解、图文大纲、V3 或 V4 通过。V3-2-3 实现仍需完成修订后的实施前内部审计和独立文档审查。

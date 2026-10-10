# V3-6 全量生产矩阵与 V3-7 最终独立审计计划

日期：2026-10-06。状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO / V3-5 PASS REQUIRED`。

## 1. 目标

V3-6 不再开发新产品功能，只用全新 build、Chrome profile、Runtime、SQLite、task/artifact root 和证据根执行完整 B站限定矩阵。V3-7 由不同 reviewer 对该单一候选和 V3-5 已签署 H01..H10 做只读复算，决定是否允许限定声明。

V3-6/V3-7 不新增人工步骤，不代签、不重跑 H 项、不用旧 run 补洞。

## 2. V3-6 输入门禁

- V3-1..V3-5 每阶段均有独立限定 PASS。
- H01..H10 submission Schema-valid，十项全部执行，bundle/build/run/hash 与 V3-5 候选一致。
- 12 页 Revision 3 registry、所有 Provider/model/assets、Extension/Runtime commit/build tree 已冻结。
- 所有 private credential 只从用户授权运行时注入，不进入 package。
- Final candidate schema、collector、verifier、secret scan、cleanup check 和 seal 算法经外部文档审查。

## 3. 单一 run 矩阵

12 个唯一 URL 分类固定为 6 个 subtitle、3 个 full-length SenseVoice ASR、1 个 multipart、1 个 restricted/blocked、1 个 low_signal/degraded。

每个样本在同一 run 中完成页面身份、授权/租约、获取路线、Transcript、Vision、Outline、三视图、Ask/拒答、seek、路由恢复、导出和清理适用项。blocked/degraded 是预期终态，不从分母删除。

## 4. 固定机器门槛 V3-6-A01..A20

| ID | 必须结果 |
|---|---|
| A01 | 12 URL 唯一且 6+3+1+1+1 精确相等 |
| A02 | build/profile/runtime/db/task/evidence root 全新且 manifest 完整 |
| A03 | 12/12 页面 identity、bvid/cid/part/时长与 registry 对账 |
| A04 | 凭据只在授权租约内使用；0 持久/公开 Cookie 值 |
| A05 | 路线顺序固定，无并行竞速或静默跳步 |
| A06 | 3/3 ASR 全长、覆盖率 >=90%、SenseVoice profile 精确 |
| A07 | 至少 1 个真实 trusted tabCapture，replay/wrong tab/background 全拒绝 |
| A08 | 10/10 OCR，>=8/10 真实授权 VLM，24/12/8 预算闭合 |
| A09 | 12 页 task/outline/timeline/mindmap identity 和 evidence closure |
| A10 | Ask answered 有证据；无证据问题正确拒答 |
| A11 | 5 类 seek 全部回读；located 误差 <=2 秒；requested/observed 均不得越过当前分 P 的 `mediaDurationMs` |
| A12 | 8 条 route direct/reload/Back/reopen 与 invalid recovery |
| A13 | Markdown ZIP/JSON schema/member/hash 可复算且 V4 deferred |
| A14 | 四视口、Axe serious/critical=0、键盘主流程通过 |
| A15 | 全部冻结故障有唯一终态，无后续写或假成功 |
| A16 | success/failed/cancelled/blocked/degraded 清理均 residual=0 |
| A17 | H01..H10 只引用 V3-5 已签署 submission，0 自动修改 |
| A18 | Runtime/Extension/V3 全量回归通过 |
| A19 | public/private 分离；secret/path/original-private scan 0 hit |
| A20 | seal、manifest、candidate binding、PRD review、false-green audit 完整 |

## 5. 故障矩阵

至少包括：Cookie 过期/撤销、租约过期/重放、字幕无效、下载 403/超时/超限、磁盘不足、FFmpeg 失败、ASR 模型缺失、capture grant 过期/错 tab/关页、OCR 资产损坏、VLM 未授权/429/5xx/timeout/撤销、Runtime 中断、SQLite transaction fault、revision conflict、Ask Provider 失败、seek identity drift、export 写入失败。

每项必须证明唯一终态、UI 可见原因、允许恢复动作、0 secret、0 residual、0 未授权后续请求。

## 6. 证据包

Private 区包含原始必要日志、私有媒体/帧 allowlist、SQLite snapshot 和 Provider 原始 receipts；Public 区只包含脱敏 JSON、hash、截图、测试结果和索引。公开 tar 禁止 Cookie/API key/token、profile、绝对路径、原始私有媒体和 DB/WAL。

Seal 对 canonical candidate JSON 计算 SHA-256；manifest 绑定每个 artifact path/bytes/hash/evidenceClass。任何后续修改都创建新 candidate，不能原地改 seal。

## 7. V3-6 子阶段

1. `V3-6-0` 冻结 collector/verifier/final schema 和授权摘要。
2. `V3-6-1` 构建全新隔离环境并验证 prerequisites。
3. `V3-6-2` 执行 12 页主矩阵。
4. `V3-6-3` 执行故障矩阵和恢复。
5. `V3-6-4` 执行四视口、Axe、键盘、seek/export。
6. `V3-6-5` 执行 cleanup、secret/path scan、全量回归。
7. `V3-6-6` 绑定 H submission、生成 public/private package、seal/manifest。
8. `V3-6-7` 内部 PRD/false-green 审计；任一 A01..A20 失败则 candidate FAIL，不进入 V3-7 成功审查。

## 8. V3-7 最终独立审计

清空 `external-audit-package/`，平铺不超过 20 文件。入口为 manifest + request；载荷包含 PRD/架构/stage gate、final schema/verifier、candidate/seal/index、矩阵摘要、H submission 与 public tar。

独立 reviewer 必须逐字节重算 manifest hash 和 seal，校验 Schema、A01..A20、12 页分类、Provider/模型/资产、清理和秘密扫描，核对 H submission 未被 V3-6 修改，并检查允许声明未扩大到 YouTube/小红书/直播/V4。

Fatal=0、Major=0 且所有机器/人工分母通过，才可声明：

`V3 Bilibili-first media companion passed the frozen subtitle/local-ASR/keyframe/OCR/authorized-cloud-VLM acceptance matrix.`

否则 final=false，并列出恢复阶段；不得发布部分成功总声明。

## 9. 当前门禁

V3-5 尚未实现和通过，final schemas/collector/verifier 尚未冻结，H submission 不存在，因此 V3-6/V3-7 均为 NO-GO。

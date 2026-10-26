# WP0 R3 Codex Checkpoint

日期：2026-10-17  
候选：`wp0-r3-2026-10-17`  
决定：**R3 PASS / R4 MAY START**

## 1. 单次 checkpoint 结论

本次按 `project-stage-workflow.md` §5.1 只处理 R3 唯一阻塞，没有重复 R3 全量回归、
文档外审或阶段 closeout。

实施证据 manifest `4/4` 一致。R3-1..R3-5 的 Controller 单一编排、Runtime started 后
producer start、两阶段停止、idle/error 清理、双轮隔离与 24 步生产 composition 已由候选
证据覆盖；集中回归除冻结哈希外均通过。

## 2. 冻结漂移分类与处置

唯一失败来自已授权 R3 修改
`apps/chrome-extension/src/modules/media_companion/capture/MediaCaptureController.ts`：

- 旧冻结 SHA-256：`b344caf3be26a2264867ce0453d6dddbffed06adb02746d58136429600d71888`
- 当前 SHA-256：`325d0b59fbd20072689c2cb7bcd46cb53ad1564c4cd6f36a6edbc4acb7f8991c`

该文件仍抽取出同一闭集的 8 个 `V3_MEDIA_*` 边界码；40 source / 20 target inventory、
消息、FailureCode、阈值和公共合同均未变化。将单启动守卫移到 Background 会新增第二编排
状态 owner，违反 R3 的 Controller 唯一编排边界，因此拒绝路线②。

Codex 按“冻结证据过期”执行一次受限重冻结：

1. fixture 仅更新该 scope SHA-256；
2. verifier 仅更新由 `sourceInventoryEvidence` 全对象推导出的 authority digest；
3. schema、trace、inventory、registry、阈值和验收分母均未修改。

重冻结文件当前 SHA-256：

- fixture：`f140632e3512825733a51180b3d86e859a2db9b89c4f3982e0c98c817d570a8c`
- verifier：`4746c702fd8d2338ce79f53a8aec23ca29c5a19943ab098de2b7acbe58c92e28`

## 3. 独立复算

- v10 baseline：`50/50 PASS`，exit `0`；40/40 source、20/20 target、unlisted `{}`。
- v10 mutations：`15/15 PASS`，exit `0`。
- R3 集中回归沿用候选的一次执行结果：typecheck、229/229 media、562/562 全量、build、
  42/42 静态合同、6/6 barrier、180 focused 均 exit `0`；本 checkpoint 不重复运行。
- Chrome / Provider / 六视频 / 声音：`0 / 0 / 0 / 0`。

## 4. 门禁决定

- Fatal：`0`
- Major：`0`
- Minor：`0`
- 待重冻结：`0`
- 公共合同变化：`none`
- **R3：PASS**
- **R4：可按 `61-codex-r4-development-and-acceptance.md` 开始实施**

R3 到此关闭，不再执行 R3 外审或重复回归。R4 完成后执行一次 Codex checkpoint；本文件
不授权 R5 的可见 Chrome、不授权 R6/R7 提前实施。


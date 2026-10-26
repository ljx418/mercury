# WP0 R4 Codex Checkpoint

日期：2026-10-17  
候选：`wp0-r4-2026-10-17`  
决定：**R4 PASS / R5 MAY START**

## 1. 单次 checkpoint 结论

本次按 `project-stage-workflow.md` §5.1 只处理 R4 唯一阻塞，没有重复 R4 全量回归、
文档外审或阶段 closeout。

实施证据 manifest `4/4` 一致。R4-1..R4-5 已覆盖 45/45 用例、62 个真实 owned Uvicorn
进程、六个故障注入点、八类损坏、四项残留清零与 durable product terminal。候选报告的
typecheck、229/229 media、562/562 全量、build、45/45 R4、6/6 barrier、187 focused、
42/42 静态合同均为 exit `0`。

## 2. 两项生产修复与冻结漂移

R4 修复：

1. WebSocket handler 只允许成功取得 capture 的连接在 `finally` 中 abort，阻止 replay
   连接终止其他连接持有的 process singleton sink；
2. `recover_cleanup` 将“无 staging root”识别为零残留，而既有但损坏的 root 继续 fail-closed。

唯一 verifier 失败来自已授权修改
`services/local-runtime/navia_runtime/app.py`：

- 旧冻结 SHA-256：`518c853dadaf769bdf53b4b6cbc13306f880833d46814c1e306e183f4e6a66a8`
- 当前 SHA-256：`51791f0568eaeeb8e539ddad392c990c877e196021bf92a0c65622ae200d3f0a`

`V3_MEDIA_CAPTURE_ORIGIN_MISMATCH` 仍存在 2 处；40 source / 20 target inventory、消息、
FailureCode、阈值和公共合同均未变化。连接级 ownership 必须留在 handler；迁移到外围入口
会弱化真实连接 owner 判断，因此按“冻结证据过期”执行一次受限重冻结：

1. fixture 只更新 `app.py` scope SHA-256；
2. verifier 只更新由完整 `sourceInventoryEvidence` 推导的 authority digest；
3. schema、trace、inventory、registry、阈值、消息集合和验收分母均未修改。

重冻结后：

- fixture SHA-256：`a89c8f09d8c27054a49bd9c85bc3475ff70b873f5543174dfeacb01fe4719d74`
- verifier SHA-256：`c4dd95d78a7e4dbba24794f3a2342a2557b4d1a0c14574cbd1a37c1d02c55191`
- `sourceInventoryEvidence` authority digest：`fc605f1044a5715dcaa0de833875076e6dc80ae82097ef5da30991bc3866005e`

## 3. Codex 独立复算

- payload manifest：`4/4 OK`；
- v10 baseline：`50/50 PASS`，exit `0`；40/40 source、20/20 target、unlisted `{}`；
- v10 mutations：`15/15 PASS`，exit `0`；
- R4 集中回归沿用候选唯一一次执行结果，本 checkpoint 不重复运行；
- Chrome / Provider / 六视频 / 声音：`0 / 0 / 0 / 0`；
- 公开证据中 Cookie、API key、ticket、原始媒体、私有绝对路径命中：`0`；
- owned 遗留进程：`0`。

## 4. 门禁决定

- Fatal：`0`
- Major：`0`
- Minor：`0`
- 待重冻结：`0`
- 公共合同变化：`none`
- **R4：PASS**
- **R5：可按 `61-codex-r5-development-and-acceptance.md` 开始预检与实施**

R4 到此关闭，不再执行 R4 外审或重复回归。R5 可见 Chrome、原生弹窗、焦点或
UIAutomation 前仍须先通知用户；所有 Chrome 必须显式 `--mute-audio`。本文件不授权 R6/R7。


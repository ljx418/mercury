# V3-2-0b-5.1 验收计划

日期：2026-09-22。固定 `B051-01..B051-12`，无 N/A。

| ID | 操作 | 必须结果 |
|---|---|---|
| B051-01 | 审查 Adapter argv | 精确包含 `--vad-maxseg 15000`，仍为固定 tuple、shell=false |
| B051-02 | 运行 Provider 单测 | 正/负路径全通过，argv 回归被覆盖 |
| B051-03 | 核对模型资产 | runtime/model/VAD size+hash 不变 |
| B051-04 | 核对三段音频 | 复用 0b-5 accepted 三 WAV，hash 逐字节相等 |
| B051-05 | 全量重跑三样本 | 三个 worker 均从零运行，0 跨 run 拼接 |
| B051-06 | 低资源边界 | 8 CPU、8 GiB、swap 0、断网、无 GPU |
| B051-07 | 时间粒度 | 每个 candidate segment 时长 `1..15000ms`，0 越界/逆序/重叠 |
| B051-08 | 固定覆盖 | 三个 120 秒窗口均产生非空 timestamped transcript |
| B051-09 | 分桶预检 | 24 个 15 秒 bin 的候选侧均非空；若语音静默需单独证据，不得默认豁免 |
| B051-10 | 资源门槛 | RSS <=8 GiB、安装 <=512 MiB、0 OOM/timeout |
| B051-11 | 私有/公开边界 | candidate/audio 0600；公开 0 Cookie/正文/private path/binary |
| B051-12 | PRD 边界 | 只关闭时间粒度风险；质量、人类双 review、production qualified 仍 pending |

出门要求：12/12 PASS，Fatal=0、Major=0，生成新的唯一 0b-5.1 handoff。若任一候选 bin 仍为空，必须返回计划阶段，不得进入新 0b-6。

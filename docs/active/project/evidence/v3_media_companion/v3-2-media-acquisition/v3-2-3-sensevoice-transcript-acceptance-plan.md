# V3-2-3 SenseVoice 全长转写验收计划

日期：2026-10-07。状态：`RESUMPTION DOCUMENT CANDIDATE / AUTOMATED ONLY`。

## 1. 前置与真实分母

前置为 `V3-2-2 Route B3 LIMITED PASS`，source run=`v3-2-route-b3-20261007T014759Z`，content SHA-256=`66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea`。该 run 只冻结三个能力槽位，不提供音频复用。

验收必须创建一个全新 `v3-2-3-sensevoice-<timestamp>` run，在其中从零创建三个新任务，按 `v3-sample-07/08/09` 固定顺序真实获取当前分 P 媒体并立即全长转写。三个任务不可来自不同 run；不接受 fixture、B3 已清理音频、旧失败 run、人工上传、字幕正文或 hash 代替音频。不请求人类听写。

验收 runner 复用 B3 已审计的预绑定 wrapper：每槽先真实发现字幕，0 候选直接媒体，存在候选时按固定映射注入一次字幕体故障，再获取真实当前分 P 媒体。fault 不得从产品 Runtime/API/env/Acquirer/registry 表达；若生产静态审计命中或动态触发总数不等于 3，整轮 `FAIL/REPLAN`。

## 2. 固定门槛 ST01..ST20

| ID | 操作 | 必须结果 |
|---|---|---|
| ST01 | Schema/meta、lineage contract、fixtures | 全部通过；FailureCode 集合与 service 映射精确相等 |
| ST02 | 绑定 B3 source | runId/content SHA、三个 sampleId/bvid/顺序精确，无旧 run artifact |
| ST03 | 创建单个 V3-2-3 run 的三个新任务 | 3 个唯一 task/source/acquisition ID；`crossRunArtifactCount=0` |
| ST04 | 三任务真实 acquisition | 3/3 `credentialed_media_asr`、当前分 P、16 kHz/mono/S16LE、真实 audio hash/bytes/duration |
| ST05 | B3 动态触发与生产隔离 | `runtime_no_subtitle + audited_subtitle_failure = 3`；fault 仅 acceptance wrapper 可达，产品静态命中 0；有字幕槽位恰好一次预绑定 fault |
| ST06 | stage 三个 `AcquisitionAudioRef` | source/staged bytes+hash+shape 相等；复制文件 0600、目录0700、nlink=1 |
| ST07 | traversal/absolute/symlink/hardlink/cross-task/mutated source | 全部拒绝，root 外字节不变 |
| ST08 | 读取 provider/model/VAD manifest | SenseVoice engine/version/revision/weights/VAD 精确；CPU/q8；无联网换模 |
| ST09 | 三个真实全长任务 | 3/3 transcript 非空；不复用旧文本；每槽位一次成功终态 |
| ST10 | FSMN-VAD count receipt | 每样本 start/end VAD count 唯一、一致且 >0；原始 stderr 不公开 |
| ST11 | 覆盖率复算 | SRT count=VAD count；coverage=1.0；任一不等直接固定失败码 |
| ST12 | segment 顺序与边界 | `0 <= start < end <= duration`，有序、不重叠、每段正文非空 |
| ST13 | hash 与 provenance | text/content/audio/acquisition/transcript hash 全可复算，task/source/route 精确闭合 |
| ST14 | 进度观察 | sequence 单调、同 task、0..100、阶段合法，终态后无新事件 |
| ST15 | 运行中取消 | native process group 终止、无 transcript 发布、只终结一次、双层清理为 0 |
| ST16 | timeout/crash/nonzero/output overflow/bad SRT/empty/VAD mismatch | 每类唯一固定 failure code；禁止 success/degraded 冒充 |
| ST17 | credential/session 与 URL/adapter 网络负例 | 两组使用独立 assertion ID；不得用单个聚合 exit code冒充覆盖 |
| ST18 | cleanup 与秘密扫描 | ASR staging、acquisition sandbox、进程、句柄、raw WAV 全为 0；公开 Cookie/path/audio/text/stderr 0 hit |
| ST19 | 低资源与回归 | 8 cores/8 GiB/no-GPU；逐样本峰值 RSS、耗时、临时磁盘真实记录；ASR/acquisition/credential/Runtime/前端全绿 |
| ST20 | PRD 检视、seal、独立审计 | seal 可重算；Fatal=0/Major=0；只声明 V3-2-3 limited pass |

## 3. 资源与执行策略

- 三个全长任务严格串行，禁止并行加载模型或并行复制三份音频。
- 任务 timeout=`max(600s, ceil(durationSeconds * 3.0))`，上限 14400s；达到上限仍未完成则 fail closed，不自动换模型。
- 每个任务 ASR 完成并封存公开 receipt 后立即执行双层 cleanup，再开始下一任务。
- 模型安装目录可复用已验证资产，但每轮必须重新核验 binary/model/VAD bytes 与 SHA-256；转写结果和媒体不得复用。

## 4. 防假绿

禁止：三段窗口替代全长；字幕替代 ASR；Tiny 替代 SenseVoice；SRT 自身生成 VAD 分母；count mismatch 时估算 >=90%；跨 run 拼接；自动清洗/补写正文；保留音频后声称 cleanup；在公开证据放正文或 Cookie；把 `development_baseline` 改成 `production_qualified`；把 acceptance fault 放入产品代码、跳过真实字幕发现、运行后更换 fault 或单槽注入多次。

## 5. 出门声明

ST01..ST20 全通过后只允许声明“V3-2-3 三个固定 B站能力槽位在同一全新 run 中完成真实媒体获取与 SenseVoice 全长本地转写”。V3-2 整体、tabCapture、视频理解、图文大纲和 V3 仍未通过。

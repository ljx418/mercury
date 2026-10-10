# V3-2-0b-5.3 固定窗口验收计划

日期：2026-09-22  
状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`

## 1. 验收场景

在 8 CPU cores、8 GiB 地址空间、无 GPU、推理期断网的真实 Runtime 中，对冻结的三个 B站真实样本各自 `30s..150s` 的原始 120 秒 WAV，从零执行 8 个 15 秒 chunk，完成机器门禁后生成匿名对比页，由两名不同人类 reviewer 只比较候选文本，不要求听写或修正。

## 2. 固定分母

| ID | 操作 | 必须结果 |
|---|---|---|
| FW01 | 校验 Schema | Draft 2020-12 meta 与 candidate instance 均 0 error |
| FW02 | 对账父候选 | 父 manifest id/hash、provider/runtime/model/VAD identity 精确一致 |
| FW03 | 读取三份 source WAV | sample/audio hash 与冻结值一致，3/3，不可换样 |
| FW04 | 生成固定计划 | 每样本正好 8 chunk，边界 `[i*15000,(i+1)*15000)` |
| FW05 | 验证音频格式 | 源帧数为 1919997/1920000/1920000；sample01 仅最终尾部零填充 3 帧；24/24 为 PCM16 mono 16kHz 且各 240000 帧 |
| FW06 | 重算 chunk hash | 24/24 可由同 source 确定性复算 |
| FW07 | 检查覆盖 | `[0,120000)` 0 gap、0 overlap、0 越界 |
| FW08 | 观察调度 | 每任务 concurrency=1，顺序 0..7，0 并发降时 |
| FW09 | 检查调用边界 | 只经 Provider Adapter/NativeProcessHost，无 UI/portal/native 直连 |
| FW10 | 扫描文本处理 | 0 相邻复制、0 去重改写、0 LLM 修复、0猜词 |
| FW11 | 检查输出完整性 | 24/24 chunk 至少 1 segment 且文本非空；不得静音/N/A |
| FW12 | 校验 local timestamp | 每 segment `0<=start<end<=15000` |
| FW13 | 校验 global merge | offset 精确；0 逆序/重叠/重复 ID/越界 |
| FW14 | 注入 chunk 失败并重试 | 新 attempt 从 chunk 0 开始；0 旧 chunk 复用/跨 run 拼接 |
| FW15 | cancel/crash/timeout/restart | 原生进程组、chunk、WAV、result、staging、路径引用全部清零 |
| FW16 | 资源实测 | 8 cores/8 GiB/no-GPU/offline；RSS<=8GiB、asset<=512MiB |
| FW17 | 延迟实测 | 三样本分别 <=16360/14760/16280ms；每个 ratio<=2.0 |
| FW18 | 生成并收集盲评 | 新 bundle；2 个不同 reviewer；24x2=48；身份不泄漏 |
| FW19 | 计算质量 | >=44/48；每样本>=15/16；critical=0；neither=0 |
| FW20 | 独立出门复审 | Fatal=0/Major=0；公开包 0 secret/path/transcript/audio；状态声明准确 |

20 项不得 N/A。FW01..FW20 与 policy registry 的 requirement tuple 和 FailureCode 一一绑定。

FW01..FW17、FW20 为自动化机器验收操作，不要求人类执行命令；FW18..FW19 的唯一人类操作是匿名播放、比较并提交 48 项判断。每个编号的执行命令、输入哈希、退出码与结果路径必须写入对应子阶段 `acceptance-result.md`，不能用本表的高层结论代替运行证据。

## 3. 真实数据与 lineage

固定 source：

| sampleId | audio SHA-256 | 源帧数 | 长窗基线 | 固定窗口上限 |
|---|---|---:|---:|---:|
| `v3-asr-comparison-01` | `2a11e09975733740d49f4a63ca7b3ec1a9ebc77e8e8897d770e1991d4c1beb05` | 1919997 | 8180ms | 16360ms |
| `v3-asr-comparison-02` | `63eb48d9027e1cfa09747d7261f9e2b7347cbec58daeb38b4aff09cdbd647405` | 1920000 | 7380ms | 14760ms |
| `v3-asr-comparison-03` | `f4f61c09f8fe19828fb2085ef18459179d5142596b8107cef82df6c7bf7cc97b` | 1920000 | 8140ms | 16280ms |

全部在新 run 私有命名空间处理；旧 `0b-5`、`0b-5.1` 与 `5.2` 只读且不得作为新输出组成部分。

## 4. 失败注入

至少覆盖：计划被改为 14/16 秒、chunk hash 篡改、chunk 3 空结果、local 时间越界、global ID 重复、进程非零退出、chunk 4 timeout、取消、Runtime 重启、cleanup 删除失败、并发>1、复用旧 chunk、elapsed>2x、reviewer ID 重复、质量差一项、公开包含 transcript/path。

每项必须产生唯一 FailureCode，不能以 generic error 掩盖。

## 5. 人类体验验收

本工作包不新增交互页面；人类只操作现有匿名比较页：

1. 打开新 bundle，页面不得显示 provider/model/chunk 技术身份。
2. 逐个播放原音频并比较 A/B 文本；不要求输入听写。
3. 每个 bin 选择更优/等价/均不可接受，标记含义与关键错误。
4. 提交后产生不可修改 review 文件；第二 reviewer 必须使用不同 ID。

Settings 回归要求：机器或人工门禁未完成时仍显示红色“已安装 · 质量未通过”、不可选择、Tiny effective；只有最终独立审查通过后才能显示 qualified。

## 6. 防假绿

以下任一情况直接失败：只重跑 sample03/bin2；复用 5.2 输出；跨 run 拼接；并行 8 进程；缩短/移动窗口；把空 chunk 标静音；重写文本；只报平均延迟；少于 48 判断；同 reviewer 复制；公开 transcript/audio/路径/Cookie；清理失败仍完成；把本阶段扩大为 V3-2/V3 PASS。

## 7. 出门条件

FW01..FW20 全 PASS 且独立实施出门 Fatal=0/Major=0，才可将 Paraformer 标为 `production_qualified` 并恢复 V3-2-A06 后续流程。任一失败则 `V3-2-0b-5.3 FAIL / REPLAN`，Paraformer 保持不可选择，V3-2-1..7 继续 BLOCKED。

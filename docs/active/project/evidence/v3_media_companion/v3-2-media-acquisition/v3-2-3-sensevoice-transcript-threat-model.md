# V3-2-3 SenseVoice 全长转写威胁模型

日期：2026-10-07。

| 威胁 | 控制 | 验收 |
|---|---|---|
| 复用 B3 已清理音频或公开 hash 冒充输入 | 全新 run/三个新 task；lineage 绑定 acquisition record 与真实 audio hash | ST02-ST04 |
| 平台字幕漂移后随意强制走 ASR | 先真实发现；仅 acceptance runner 按预绑定 fault 单次触发；产品 fault 0 可达；动态两类计数和=3 | ST04/ST05 |
| 跨 run 拼接三个样本 | run 级 manifest、三个唯一 task、`crossRunArtifactCount=0` | ST03/ST13 |
| 任意文件/跨任务读取 | 只接受 acquisition sandbox 的 `ArtifactRef`；流式私有复制；绝对路径/link/mutation 全拒绝 | ST06/ST07 |
| staging 双份音频残留 | provider finally 清 ASR staging；service barrier 清 acquisition sandbox；任一失败禁止成功终态 | ST15/ST18 |
| 模型、VAD 或 executable 替换 | build-time catalog、revision/bytes/hash、禁止自更新和网络换模 | ST08 |
| native process 注入 | argv 数组、`shell=false`、allowlist executable、最小环境、进程组终止 | ST08/ST15/ST16 |
| 输出洪泛、卡死或资源耗尽 | 输出上限、按时长 timeout、三任务串行、8 GiB/8 core/no-GPU 真实观测 | ST16/ST19 |
| stderr 泄露路径或环境 | adapter 只解析冻结 VAD count 行；公开 DTO 不含 stderr；双层扫描 | ST10/ST18 |
| SRT 文本/时间伪造 | strict parser、逐段/hash/边界复算，禁止正文修写 | ST12/ST13 |
| 用 ASR 输出自身制造覆盖率 | 独立读取 FSMN-VAD 总段数；SRT count 必须完全相等，否则 fail closed | ST10/ST11 |
| 取消后晚到写入 | cancel token、进程组先停、终态屏障、双层 cleanup | ST14/ST15 |
| Cookie、音频、正文或路径进入公开包 | 私有扫描真实值；公开扫描上下文；tar denylist；只发布不可逆 hash/计数 | ST18 |
| 聚合退出码掩盖负例缺失 | credential/session 与 URL/adapter/network 分组独立 assertion ID | ST17 |
| 人工文本或字幕替代 ASR | `humanTranscriptInputCount=0`；字幕 artifact 不接受为 ASR input | ST03/ST09 |
| 质量过度承诺 | 固定 `development_baseline`；语义质量退化和跨模型回退保留 V4 | ST20 |

剩余风险：VAD 总段数不提供遗漏段时长，因此当前实现只在所有 VAD 段均产生非空 SRT 时成功。这可能拒绝部分仍达到 90% 的结果，但不会把缺段结果误报为通过。SenseVoice 的语义准确度仍由已有人类盲评结论和 V4 质量优化承接，V3-2-3 不重复要求人类听写。

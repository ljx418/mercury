# V3-2-0b-6 双模型盲评材料开发计划

日期：2026-09-22  
状态：`AUTHORIZED / PREIMPLEMENTATION AUDITED`

## 目标

复用 0b-5 accepted run 的三段同源真实音频与 Paraformer 候选输出，在相同低资源、无 GPU、推理期断网边界内运行冻结的 `faster-whisper-small` 基线。将两套机器输出切分成固定 3 x 8 个 15 秒区间，生成不泄露模型身份的 A/B 盲评页面和可验证 bundle。人类只需听原视频并比较两套机器结果，不做人工听写。

## 唯一输入

- 上游 run：`v3-2-0b-5-20260922T063133Z`。
- 私有 handoff SHA-256：`726dae961e4bd75cb23a71c3d911138fc26b460adf246e0253d6f4359cb66c14`。
- 样本固定为 `v3-asr-comparison-01..03`，分别绑定 `BV1sMNtzJE5B`、`BV1xz4y1S7yF`、`BV1Bb411w741` 的 P1 `30s..150s`。
- 音频必须逐字节匹配 0b-5 的三个 SHA-256；不重新下载、不拼接其他 run。
- 基线模型固定为 `Systran/faster-whisper-small@536b0662742c02347bc0e980a01041f333bce120`，文件集合必须匹配冻结 manifest。

## 实施实体

1. `v3_asr_small_baseline_worker.py`：只读单个私有 WAV 与冻结 Small 模型，使用 CPU/int8、beam1、VAD500、no-context 输出 timestamped segments。
2. `v3_asr_blind_bundle_generator.py`：校验上游 lineage、模型和私有权限；在 systemd 低资源单元运行三个基线 worker；按 segment 中点映射到 15 秒 bin；生成公开 A/B bundle、私有 label map 和审查 HTML。
3. `v3-asr-provider-qualification-review-template.html`：仅显示原视频深链、候选 A/B 文本和结构化判断控件；不显示 provider/model/label map；导出 `v3-asr-provider-qualification-review/v1`。
4. `v3-asr-provider-qualification-page-qa.mjs`：真实 Chrome 四视口、Axe、键盘、24 项导出和双 reviewer 导入/裁决烟测。
5. `verify_v3_asr_blind_bundle.py`：独立重算 lineage、音频/模型/bundle/page/label-map hash、24 bin 集合、盲化、权限、QA 与敏感信息扫描。

## 盲化与生命周期

- A/B 映射按 bundle seed 对每个 sample 独立确定，映射只写 Linux 私有根 `0700/0600`；HTML、bundle、QA 导出均不得包含 candidate/baseline/provider/model 标识或私有绝对路径。
- 人类 review 导出的字段直接使用语义角色 `candidateMeaningPreserved` / `baselineMeaningPreserved`，由页面运行时通过一次性不可见映射转换会泄露身份，因此禁止。页面只导出 A/B 原始判断；受信任的离线 adjudicator 在私有映射下转换为资格合同。为保持合同闭合，本阶段页面导出使用加密式 opaque side (`side_a`/`side_b`) 判断，独立汇总工具在私有边界完成转换。
- 页面不得提供听写文本框；reviewer 必须通过 B站时间深链听原声，只比较现有两套机器文本。
- bundle 完成且 QA 通过后，私有 WAV 和原始中间 baseline/candidate 文件仍保留至两名 reviewer 与裁决完成；不得提前删除导致无法复核。0b-7 出门前必须删除。

## 子阶段顺序

1. `0b-6a`：输入和合同冻结。
2. `0b-6b`：Small 基线真实离线推理。
3. `0b-6c`：24-bin 盲化 bundle 与页面生成。
4. `0b-6d`：真实 Chrome 页面验收与独立 verifier。
5. `0b-6e`：两名不同 reviewer 各 24 项判断及必要裁决，属于人类高风险门槛。

机器阶段只允许推进至 `0b-6d PASS / 0b-6e PENDING`。Agent 不得伪造 reviewerId、听辨结果或质量 PASS。

## 停止条件

任一输入 hash、模型文件、权限、断网/GPU、24-bin 分母、盲化扫描、页面 QA 或导出 schema 失败，均返回计划阶段。机器材料全部通过后若尚无两个不同 reviewer 的 48 项判断，自动化必须停止，不得进入 0b-7 或设置 `production_qualified/selectable=true`。

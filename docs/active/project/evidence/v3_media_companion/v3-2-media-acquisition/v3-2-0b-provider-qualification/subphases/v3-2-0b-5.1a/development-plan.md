# V3-2-0b-5.1a 失败证据可审计化开发计划

日期：2026-09-22。状态：实施前计划。

## 目标

修复 `v3_asr_vad_granularity_runner.py` 在真实候选出现空 15 秒 bin 时直接抛异常、只留下私有输出而没有公开机器诊断的问题。该修复只增强失败证据，不改变 Paraformer Q8、FSMN-VAD、三段 WAV、15 秒 VAD 上限、分桶算法或质量门槛。

## 修改边界

- 修改 `services/local-runtime/scripts/v3_asr_vad_granularity_runner.py`，新增只读 `verify_v3_asr_vad_failure.py`。
- 空 bin 时仍完成三样本检查，公开写入无正文的 `failure-diagnostic.json` 与 `invalidated.json`，进程返回非零。
- 诊断只包含 hash、segment 数量、bin 计数/字符数、PCM RMS、资源统计和失败码；不得包含 transcript、音频、Cookie、绝对私有路径或模型二进制。
- 成功路径维持原合同；失败 run 不生成可供 0b-6 使用的 private handoff。

## 顺序

1. 冻结验收分母和实施前审计。
2. 修改 runner 的失败终态。
3. 用原 accepted 0b-5 WAV 与相同模型资产创建全新 run。
4. 验证退出码、公开诊断、私有权限和秘密扫描。
5. 运行 Runtime 全量回归并形成 PRD/出门审计。

## 非目标

不调低 `B051-09`，不切换模型，不重新切音频，不进入盲评，不修改产品 catalog 的资格状态。

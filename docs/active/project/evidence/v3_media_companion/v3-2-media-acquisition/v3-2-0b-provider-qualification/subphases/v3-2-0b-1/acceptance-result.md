# V3-2-0b-1 Provider Adapter 与 Native Host 验收结果

日期：2026-09-22  
runId：`v3-2-0b-1-20260922T044245Z`

## 结论

```text
B01-01..B01-16: 16/16 PASS
ASR provider + model-manager regressions: 32 passed
Fatal=0 / Major=0 / Minor=0
V3-2-0b-1: PASS
```

## 真实路径

- Linux `llama-funasr-paraformer` bytes=`2424840`、SHA-256=`aec677df81ac5d8a2274342d92df1290e4bc901f4ebb74f113d3e5d95377c0c2`。
- usage 探测包含 `-m/-a/--vad/--srt`，上游冻结行为 exit=`1`，网络符号扫描 0 命中。
- 真实 Paraformer Q8 + FSMN-VAD load/self-test 完成，耗时 `0.745s`，任务目录清理成功。
- 自检输入为非语音合成音，SRT 为空是预期；不计入质量分母。

## 修复闭环

- 首轮测试发现快速退出时 output overflow 标记晚于主循环的竞态；已在 reader join 后二次 fail-closed，回归通过。
- 跨平台复核补充拒绝反斜杠逃逸与 task 根 symlink；回归通过。

## 证据

- `runs/v3-2-0b-1-20260922T044245Z/pytest.xml`
- `runs/v3-2-0b-1-20260922T044245Z/real-probe.json`
- `runs/v3-2-0b-1-20260922T044245Z/acceptance-result.json`

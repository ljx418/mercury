# V3-2-0b-2 Catalog / Manager / Installer 验收结果

日期：2026-09-22  
runId：`v3-2-0b-2-20260922T050622Z`

```text
B02-01..B02-16: 16/16 PASS
ASR regressions: 37 passed
Fatal=0 / Major=0 / Minor=0
V3-2-0b-2: PASS
```

真实离线安装读取 `246664010/246664010` bytes，验证 runtime archive/Q8/VAD 后仅发布 `llama-funasr-paraformer`、`paraformer-q8.gguf`、`fsmn-vad.gguf`。真实 self-test 完成并进入 ready；`quality=qualification_pending`，选择请求返回 `V3_ASR_MODEL_NOT_QUALIFIED`，effective 保持 Tiny。重启识别 ready，卸载后 Tiny 仍 effective，package/staging/candidate 均清理。

首轮真实发布遇到 WSL/Windows 对刚执行 binary 的短暂文件锁；采用有限时原子 rename 重试后通过，并增加瞬时 PermissionError 回归。没有改为非原子复制。

证据：

- `runs/v3-2-0b-2-20260922T050622Z/real-install-probe.json`
- `runs/v3-2-0b-2-20260922T050622Z/pytest.xml`
- `runs/v3-2-0b-2-20260922T050622Z/acceptance-result.json`

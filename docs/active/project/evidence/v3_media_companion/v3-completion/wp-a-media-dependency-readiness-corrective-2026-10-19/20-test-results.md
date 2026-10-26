# WP-A 纠偏测试结果

| 门禁 | 结果 |
|---|---:|
| 文档 verifier | 42/42 |
| WP-A Runtime 四文件 | 73 passed |
| Runtime related | 149 passed |
| Runtime media/capture/transcript/asr | 450 passed |
| Extension targeted | 2 files / 15 tests |
| Extension media subtree | 59 files / 478 tests |
| TypeScript | PASS |
| Extension build | PASS，4.67 MB |
| A23 fresh production-manager download | PASS，3,072,469 bytes，冻结 SHA 精确一致 |
| A24 public API real run | PASS，64 个非空、时间单调 segment |
| relay v11 baseline | 50/50 |
| relay v11 mutations | 16/16 |

## A24 事实

`credential channel 201 -> credential lease 201 -> acquisition 201 -> execute 200 -> credentialed_media_asr -> transcript succeeded`。固定样本为 `BV1Bb411w741 / CID 61744125 / p1`；capture 启动 0，声音 0，Chrome 0，Provider 0。公开证据不含 Cookie、token、原始音频或转写正文。

## 资源说明

Extension media 子树使用 `--maxWorkers=2`，耗时 981.87 秒但自然完成；未并发重复启动全量回归。A23/A24 的 owned Runtime、端口、临时根均在 finally 中清理。


# V3-2-0b-5.1 验收结果

日期：2026-09-22。结论：`FAIL / REPLAN`。

| ID | 结果 | 证据 |
|---|---|---|
| B051-01 | PASS | 生产 Adapter 固定 `--vad-maxseg 15000`、tuple argv、`shell=False` |
| B051-02 | PASS | Provider/normalizer 29 passed；Runtime 全量 389 passed |
| B051-03 | PASS | runtime/model/VAD 固定 bytes 与 SHA-256 未变 |
| B051-04 | PASS | 三 WAV hash 与 accepted 0b-5 逐字节一致 |
| B051-05 | PASS | 三样本均从零顺序推理，0 跨 run 拼接 |
| B051-06 | PASS | 8 cores、8 GiB、swap 0、AF_INET 拒绝、无 GPU |
| B051-07 | PASS | 全部 segment `<=15000ms`，时间合同有效 |
| B051-08 | PASS | 三个 120 秒窗口均有总体 transcript |
| B051-09 | **FAIL** | sample 03 / bin 2 为 0 segment；PCM16 RMS=1948，非静音 |
| B051-10 | PASS | 峰值 RSS 低于 319 MiB；安装约 230 MiB；0 OOM/timeout |
| B051-11 | PASS | 私有根 0700、文件 0600；公开诊断无正文/秘密/私有路径 |
| B051-12 | PASS | 未声明质量通过，未进入盲评 |

固定分母结果：11/12 PASS。单项 Major 失败足以阻断子阶段；不得以总体 transcript 非空替代 24-bin 完整性。

权威失败证据：`runs/v3-2-0b-5.1-20260922T072602Z/`，`verification.json` 对失败证据链为 8/8 PASS，但该 PASS 只说明失败事实可复算。

# V3-2-0b-1 实施前审计

日期：2026-09-22

## 结论

```text
V3-2-0b-1: GO
Fatal=0 / Major=0 / Minor=2
```

## 前置核对

- `0b-0` 真实资产 4/4、B00-01..12 12/12 PASS，许可与归档安全已闭环。
- 实施目录限定为 `services/local-runtime/navia_runtime/modules/media_companion/asr/` 与对应 tests/scripts。
- 产品 catalog/manager/API/UI 在本子阶段保持不变，避免把未资格候选提前暴露为可安装能力。
- 固定 B01-01..16 覆盖正向生命周期、任意路径、shell/env、timeout/cancel/crash/output limit 和真实 binary。

## Minor

- M-1：真实 CLI 参数必须由 0b-0 归档 README 与 usage 探测发现，文档不预猜命令格式。实测 `--help` 输出 usage 且 exit=1，已修订 B01-14，禁止误写为 exit=0。
- M-2：当前 Linux 宿主无法真实执行 Windows binary；保留为静态命令与归档覆盖，不扩大结论。

## 审计意见闭环

M-1 已通过真实归档 README 与 binary 探测闭环：命令固定为 `llama-funasr-paraformer -m <model> -a <audio> --vad <vad> --srt`，usage 探测 exit=1 为上游实测行为；M-2 已在验收防假绿中明确，不影响 Linux 目标实现。无新增 Fatal/Major，可进入实质开发。

# V3-3-0 外部审计后闭环

日期：2026-10-08。上游报告：`independent-document-audit.md`。

## 1. 独立结论

外部审计结论 Fatal=0/Major=1/Minor=2，确认 `OCR AND SAMPLE FREEZE PASS`，并确认 V3-3 必须继续等待真实 VLM capability probe 与 `selected_frame_cloud_vision` 用户授权。

## 2. Minor 处置

- m-1 通过 `v3-3-platform-support-addendum.md` 冻结 Windows/Linux 轮子并明确 macOS 非 V3 承诺而关闭。Windows 真实安装/推理仍属实施验收，不提前报 PASS。
- m-2 作为不提交 31 MiB 第三方 ONNX 权重的有意供应链边界保留；固定官方 wheel hash、wheel 内单资产 bytes/hash 和安装后断网 self-test 三层门禁不变。下一外审必须自行下载固定 wheel 解包复算，不能仅信任 manifest。

## 3. 当前决定

`OCR AND SAMPLE FREEZE PASS / VLM AUTHORIZATION REQUIRED / V3-3 IMPLEMENTATION NO-GO`。

未关闭 Major 仍只有 V3-3-M2：真实 Provider/model/credential capability probe 和用户选定帧上传授权。

## 4. Capability probe 工具准备

2026-10-08 新增 fail-closed 中性图 verifier：

- 脚本：`services/local-runtime/scripts/v3_vision_capability_probe.py`，SHA-256 `0044cefbc6dab2107eb2535d7ff07c172a16dc9d4005fefd9350012623696fa2`。
- 测试：`services/local-runtime/tests/test_v3_vision_capability_probe.py`，4/4 PASS，SHA-256 `0d7941998cb065f3e0d9feadcde11b8be51ac64e6c7d3fa8a15347067322d58d`。
- dry-run：`v3-3-vlm-neutral-probe-dry-run.json`；内容仍固定 `executed=false / passed=false`，且 verifier 现以 exit 3 表示“未执行”，避免只看退出码的下游假绿。当前 SHA-256 由最新审计 manifest 绑定。
- 中性 PNG 由脚本确定性生成，589 bytes，不含用户/B站内容；只记录 image/request hash，不保存 data URI、请求体或 credential。
- dry-run 明确记录 `executed=false`、`passed=false`、`VISION_CAPABILITY_PROBE_NOT_EXECUTED` 并返回 exit 3；Authorization/Bearer/API key/`sk-*` 扫描均为 0。

这项准备不改变当前决定。只有真实 capability probe 成功且用户另行授权真实选定帧上传，V3-3-M2 才能关闭。

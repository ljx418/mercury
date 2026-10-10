# V3-3 Capability Verifier 增量独立文档审查请求

日期：2026-10-08。审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`。

## 1. 决策范围

本轮只读审查 V3-1.4/V3-2 前置状态、V3-3 OCR/样本冻结、VLM 候选和新中性图 capability verifier。不得执行云端请求，不得读取或请求 API key，不得上传中性图或真实帧，不得批准 V3-3 产品实施。

## 2. 候选自报

- V3-1.4 已由当前工作树真实 Chrome/Runtime 再验证 7/7，V3-2 唯一生产 run 已取得独立 `LIMITED PASS`。
- OCR/sample freeze 既有独立结论保持 PASS：10 个成功样本为 `6 subtitle + 3 asr + 1 multipart`，前 8 个是固定云目标。
- 新增 `v3_vision_capability_probe.py`：只生成中性 checkerboard；默认 dry-run；仅显式 `--execute-neutral-probe` 且环境凭据存在时联网。
- verifier 固定 `openai-responses-vision` / `gpt-4.1-mini-2025-04-14` / `/responses`，使用 `store=false`、`detail=low`、无 tools、最多 300 output tokens 和 JSON Schema Structured Output。
- 4 项离线测试 PASS。加固后的 dry-run 明确 `executed=false / passed=false / VISION_CAPABILITY_PROBE_NOT_EXECUTED` 且进程 exit 3；缺凭据执行分支 exit 2，秘密扫描 0 命中。
- 当前仍无任何已配置视觉凭据，且未获得用户对真实8张选定B站帧上传的高风险授权。
- 候选决定保持：`OCR AND SAMPLE FREEZE PASS / VLM AUTHORIZATION REQUIRED / V3-3 IMPLEMENTATION NO-GO`。

## 3. 必须独立复算

1. 19 项 payload SHA-256 及包副本与权威源字节一致性。
2. V3-1.4/V3-2 是否只允许 V3-3 进入实施前门禁，未被扩大为 V3 总体通过。
3. RapidOCR manifest、离线 probe、10 样本 registry 和 V3-2 审计是否仍支撑 OCR/sample freeze。
4. capability verifier 是否只构造中性图，默认不联网，缺凭据 fail closed，且报告不含 key、Authorization、Bearer、data URI 或原始请求体。
5. verifier 是否精确约束 provider/model/base/endpoint、image detail、`store=false`、无 tools、output schema、usage 和 exact model response。
6. 独立执行 dry-run 并确认 exit 3；独立执行缺凭据分支并确认 exit 2。必须证明只有真实 probe 成功路径返回 exit 0，且 `passed=false` 仍为机器可见硬事实。
7. 判断除“真实中性图 capability probe + 用户真实选定帧上传授权”外，是否新增任何 Fatal/Major。

## 4. 禁止扩大

- 不得运行 `--execute-neutral-probe` 或任何产品/云端请求。
- 不得把 verifier、dry-run、fixture、当前 Agent 视觉或 OCR probe 报成真实 VLM capability PASS。
- 不得把中性图 capability probe 授权等同于真实B站帧上传授权。
- 不得修改主工作树、历史 run、seal 或已有审计报告。

## 5. 输出

报告写入：

`docs/active/project/evidence/v3_media_companion/v3-3-dependency-freeze/independent-capability-verifier-audit.md`

报告必须给出 Fatal/Major/Minor 和三个独立决定：

1. V3-1.4/V3-2 前置是否仍有效。
2. OCR/sample freeze 是否仍成立。
3. V3-3 是否仍只能等待真实 capability probe、凭据与用户高风险授权。

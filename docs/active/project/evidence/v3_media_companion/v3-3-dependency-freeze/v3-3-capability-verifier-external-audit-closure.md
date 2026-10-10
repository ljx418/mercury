# V3-3 Capability Verifier 外部审计闭环

日期：2026-10-08。  
独立报告：`independent-capability-verifier-audit.md`。  
报告 SHA-256：`5e8b4dd22050e48ebdf4577dc90a88a8b66e1407fe4678d7d51c5e6865a7c5c6`。

## 1. 独立结论

- 19/19 payload SHA-256 与权威源字节完全一致。
- Capability verifier 的默认不联网、显式执行开关、缺凭据 exit 2、报告脱敏、固定 provider/model/request/output/usage 约束均通过独立代码复核。
- 初审确认 dry-run 的机器事实为 `executed=false / passed=false / VISION_CAPABILITY_PROBE_NOT_EXECUTED`；随后已进一步加固为 exit 3，使任何 exit 0 都只可能来自真实 probe 成功，消除仅检查退出码的误判路径。该变更需由下一审计包重新复算。
- V3-1.4/V3-2 前置保持有效；OCR/sample freeze 保持有效。
- Fatal=0、Major=0、Minor=0；这里的 Major=0 表示本轮 verifier 增量没有新增缺陷，不表示上游 VLM 门禁已经关闭。

## 2. 当前门禁

决定保持：

`OCR AND SAMPLE FREEZE PASS / CAPABILITY VERIFIER AUDIT PASS / VLM AUTHORIZATION REQUIRED / V3-3 IMPLEMENTATION NO-GO`。

仍需同时满足：

1. 在用户本机安全配置真实视觉 Provider 凭据，密钥不得进入对话、Git、日志或审计包。
2. 用户明确批准中性图 capability probe 产生一次外部请求及可能费用。
3. 中性图真实 probe 返回 exact model、completed、Schema-valid observation 和完整 usage。
4. 用户另行明确批准最多 8 张冻结B站选定帧上传，以及 `store=false` 不等于 Zero Data Retention、默认滥用监测日志最多保留30天的边界。

未满足以上条件时，不得实施 V3-3-1..7，不得把本地 OCR 或当前 Agent 视觉替代产品 VLM。

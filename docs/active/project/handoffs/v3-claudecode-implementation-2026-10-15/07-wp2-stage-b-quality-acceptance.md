# WP2：Stage B 六视频与内容质量

状态：`BLOCKED BY FULL STAGE A PASS`。

唯一分母为 `stage-b-six-video-registry.json` 的六个 BVID；不得替换、删除或跨 run 拼接。每样本 fresh Runtime/database/profile/task，Chrome `--mute-audio`，单任务单 Provider。两个及以上 blocked 整包 NO-GO。

每样本记录 route、authority、task/revision、transcript/OCR/caption hash、<=100 字 whole-video brief、全片章节、claim-evidence、帧/seek、Provider snapshot、资源、cleanup 和公开扫描。确定性 composer/strict schema 不能替代内容正确。

B-5-4..7 要求资源清理、无秘密 closure package、implementation handoff、manifest SHA-256。宿主 LLM 按事实正确、相关、概括性、全片覆盖、章节平衡、claim-evidence、截图匹配、seek 可用和证据不足拒答逐视频完成 B-6 复核。

ClaudeCode 完成 B-5/B-6 后只形成 `STAGE B IMPLEMENTATION CANDIDATE` 并停止。随后由未参与实现和 B-6 的 Codex 独立 Agent 执行 B-7 实施出门审计，审计任务、dispatch 和 prompt hash 必须与实现及 B-6 不同。只有 B-7 Fatal=0/Major=0、Codex明确给出完整 `STAGE B PASS` 后才允许 WP3；B-7 不是人类签署。WP5 的人工内容体验复核统一称 `V3-5.1 human review`。

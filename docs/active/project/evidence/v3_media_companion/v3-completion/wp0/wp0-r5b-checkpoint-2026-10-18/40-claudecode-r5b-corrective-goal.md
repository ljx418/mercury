# ClaudeCode CLI 一键 Goal：R5-B trusted input corrective

```text
你在 /mnt/c/workspace/navia 继续 Navia V3 WP0 R5-B，当前状态为：
R0-R4 PASS；R5-A PASS；R5-B NO-GO（M-R5B-01）；R6/R7/P1 不得启动。

必读：
1. AGENTS.md
2. docs/active/project/design/project-stage-workflow.md §5.1
3. docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
   wp0-r5b-checkpoint-2026-10-18/10-codex-r5b-decision.md
4. 同目录 20-test-results.md、30-prd-review.md
5. wp0-r5-checkpoint-2026-10-18/61-codex-r5b-development-and-acceptance.md

只处理 M-R5B-01：在当前 Windows Chrome + 200% 显示缩放环境中，为 production unpacked build
建立一个可重复的用户可达可信点击路径。优先修复测试基础设施，不放宽产品的 isTrusted、
userActivation、sender surface、grant 或 tab binding 安全边界。禁止 DOM click 冒充可信输入，禁止
直调 Controller/grant/route failure/materialize/database/store。

固定输入仍是 https://www.bilibili.com/video/BV1Bb411w741，CID 61744125，p1，258s，0 字幕；
Cookie 使用桌面 myCk.txt，但不得打印或进入公开证据。所有 Chrome 必须 --mute-audio。

验收目标不变：三路精确失败后，从真实可见控件产生 trusted grant，捕获 >=15000ms，证明
Background 唯一 WS owner、Offscreen PCM producer、bytes/chunks >0、sequence/ACK 正确，随后由
frozen SenseVoice 产生非空时间戳 transcript，并完成同 task 的 succeeded -> Side Panel materialize ->
ready|degraded。R5B-01..12 全部满足才可交 Codex checkpoint。

实现内只跑定向测试；条件真实改变后只跑一次 visible canary。不要反复重跑同一阻塞，不启动 R6，
不 commit/push/reset/clean/checkout/revert。交付 changed files、合同变化、命令/退出码、真实 task/capture
ID、R5B-01..12、声音/Provider/secret/cleanup 和停止原因。
```


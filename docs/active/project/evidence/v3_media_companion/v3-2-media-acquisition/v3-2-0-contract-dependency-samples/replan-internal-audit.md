# V3-2-0 样本分母重规划内部审计

日期：2026-09-18。审计范围：授权态样本漂移、候选发现、音频/ASR 探针、revision 2 变更请求和当时的人工 gold 门禁。2026-09-18 后续用户决策已用双模型盲评替代人工逐字听写，当前状态见 `asr-comparison-method-change.md`。

## 结论

```text
Candidate page discovery: PASS
Candidate audio/offline-ASR viability: PASS
Cookie/media/profile cleanup: PASS
Revision 2 proposed denominator: PASS at document level
Human gold review: PENDING
V3-2-0 productionReady registry: NO-GO
V3-2-1+: BLOCKED
Fatal: 0
Major: 1 (human gold not completed)
Minor: 2
```

## 已关闭问题

1. 旧 3 个 ASR 样本在 Cookie 主路径下有字幕：不复用旧标签，提出新矩阵。
2. 候选只做页面判断可能把静音计 ASR：5 个候选完成真实音频 + 本地离线 ASR；正式 3 个主候选均判为 `zh`。
3. 多 P 身份歧义：主候选固定 partIndex 和 cid；registry 的 duration 必须用目标 part 时长，不得用合集总时长。
4. yt-dlp 参数假绿：将无效 `--no-plugins` 改为正式 `--no-plugin-dirs`，新增真实 `--simulate` exit 0 探针。
5. secret 残留：Cookiefile、源媒体、音频片段、work dir、Chrome profile 均终态删除；原值扫描 0 hit。

## 未关闭 Major

`D08` 要求每个主 ASR 样本各 120 秒、两位不同人类独立转写并完成 adjudication。Agent 不能代签，机器 ASR 不能冒充 gold。当前只能冻结窗口和提供回填工具，因此 revision 2 仍不得声称 `productionReady=true`。

## Minor

- M-1：候选事实来自多个独立 discovery run，正式 revision 2 仍必须在一个全新的 12 页 run 中重采，禁止跨 run 拼成 production evidence。
- M-2：主样本包含普通话和粤语；adjudication 必须固定繁简体、语气词、数字和不可辨识标记规则，否则 CER 不可比较。

## 实测复核

- V3 acquisition contract audit：49/49 case，13 schema + 36 semantic，0 failure。
- 5 候选联合音频 run：5/5；补充中文候选 2/2；每项 150 秒且本地 ASR 非空。
- 审计包：18 载荷 + 1 manifest，18/18 与权威源逐字节相等，Cookie 原值扫描 19 files / 0 hit。
- Gold review HTML：真实 Chrome/CDP 加载，3 个样本卡片，填写后成功触发 `v3-gold-review-reviewer-test.json` 下载；测试 profile 因 Windows 文件锁首次清理失败，随后精确终止唯一测试进程并确认 profile 不存在、matching Chrome=0。该测试文本未写入仓库，也不计人工 gold。

## PRD 与架构检视

- 保留 B站优先、Cookie 主路径、字幕优先、本地 ASR 和通用 portal adapter 边界。
- 固定分母仍为 12 与 6+3+1+1+1；锚点 `BV1ZpYd66ELP` 保留。
- 没有引入 YouTube/小红书实现、云 ASR、DRM/付费绕过、OCR/VLM、大纲或 V4 能力。
- 旧 revision 1 和所有 sealed evidence 不修改。

## 出门决定

完成两位人类 reviewer 和 adjudication 后，必须先做一次独立文档/证据审查并取得 Fatal=0/Major=0；用户批准矩阵后，才允许生成 revision 2 并恢复 V3-2-1。

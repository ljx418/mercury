# V3-2-0 样本分母重规划独立审查请求

日期：2026-09-18。入口：本次 `external-audit-package/AUDIT_MANIFEST.md`。审查性质：只读文档、合同、候选证据与 fail-closed 门禁审查。

## 1. 背景

V3-2 文档候选此前独立审查为 Fatal=0/Major=0。实际 V3-2-0 执行时，用户授权 Cookie 让 revision 1 的三个 ASR 样本分别暴露 4/2/7 个字幕项，导致固定分母失效。实施代理没有沿用旧标签，而是停止 production-ready 生成并进行私有候选发现。

## 2. 本次候选声明

- 合同 mutation 现为 49/49 实际执行通过，新增 Chrome 权限闭集负例。
- yt-dlp/ffmpeg/faster-whisper/model 已固定版本与 hash；无效 `--no-plugins` 已修为 `--no-plugin-dirs`，真实 `--simulate` exit 0。
- 3 个中文主 ASR 候选、1 个中文备选、1 个英语回归备选均通过授权态无字幕页面判断和 150 秒真实音频离线 ASR。
- Cookiefile、源媒体、音频片段、work dir 和 Chrome profile 已清理；原值扫描 0 hit。
- 没有生成 production-ready revision 2，因为 3 个 120 秒 gold window 仍需两位不同人类独立转写和 adjudication。

## 3. 必须独立核查

1. revision 1 三个 ASR 样本在授权态出现字幕后，停止并替换是否符合 PRD/验收计划，还是构成换样逃避。
2. 拟议 12 项矩阵是否仍为 12 个唯一 URL、6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low_signal；锚点是否保留。
3. 三个主 ASR 候选是否都固定到具体 BVID/partIndex/cid、至少 120 秒、字幕项 0、模型语言 `zh`、真实语音非空。
4. 多 P 候选作为 ASR 主分类是否与单独 multipart 主分类冲突；主分类互斥和 target part 是否足够消除歧义。
5. 候选发现跨多个 run 是否仅用于 pre-production discovery；正式 revision 2 是否仍明确要求一个新 12 页 run，禁止跨 run 拼 production evidence。
6. `dependency-manifest.json` 的 runtime arguments、禁插件/更新/exec 和 ffmpeg network deny 是否可实现；版本探针是否已避免 invalid-option 假绿。
7. `gold-window-review.html` 是否会预填/泄露机器文本、Cookie 或另一个 reviewer 的结果；双人独立性、adjudication 与 hash 是否充分。
8. 当前 `Major=1` 是否必须保留到双人 gold 完成；是否存在文档把 candidate viability 升级成 CER/V3-2 PASS。
9. 旧 revision 1、V3-1.3 和其他 sealed evidence 是否保持不可变。

## 4. 期望决定

请给出 Fatal/Major/Minor，并在以下决定中择一：

```text
A. REPLAN DOCUMENT PASS / HUMAN GOLD REVIEW REQUIRED
   允许两位人类执行 gold review；不允许生成 production-ready revision 2 或进入 V3-2-1。

B. REPLAN FAIL
   指明样本矩阵、证据、隐私或门禁仍需修复的 Major。
```

即使选择 A，也不得声明 V3-2-0 PASS、V3-2-1 GO、ASR CER PASS 或 V3 PASS。

## 5. 审查输出

请保存到：

`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0-contract-dependency-samples/independent-sample-replan-audit.md`

只读审查不得运行产品 downloader、打开用户 Cookie 文件、修改旧 registry、生成机器 gold、运行旧 PX generator/validator 或提交代码。

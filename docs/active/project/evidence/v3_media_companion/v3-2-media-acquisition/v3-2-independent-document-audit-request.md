# V3-2 受控媒体获取文档候选独立审查请求

日期：2026-09-17。审查类型：独立只读文档、机器合同和 Draw.io 审查。

## 1. 阅读入口

先读平铺包中的 `AUDIT_MANIFEST.md`，再读本文件。审查者必须独立重算 19 个 payload SHA-256，并核对 manifest 的 authoritative source mapping。禁止使用候选自报结果替代独立复算。

## 2. 决策对象

```text
V3-1.3 Browser-to-Runtime credential transport: PASS（上游事实，保持）
V3-2 document candidate: CONDITIONAL GO or FAIL
V3-2 implementation: remains NO-GO until explicit user authorization
```

本次不审查 V3-2 产品实现，因为字幕正文获取、yt-dlp、local ASR、tabCapture/Offscreen 和 V3-2 UI 尚未实施。不得把文档通过扩大为媒体获取、视频理解、V3 或 V4 通过。

## 3. 必须独立验证

### 3.1 文档和架构

1. PRD §18.4、架构 §22.7、stage gate §12、合同/开发/验收/威胁模型范围一致。
2. 唯一路线为 `credentialed_subtitle -> credentialed_media_asr -> public_or_page_subtitle -> trusted_tab_capture_asr`，无并行竞速或静默跳步。
3. V3-1.3 lease 只作为同 task credential authority；V3-2 不延长、复制、持久化或把公开 leaseId 当 capability。
4. Chrome Capture 冻结 Chrome 116+、30 秒 one-shot grant、stream ID 立即一次消费、唯一 `USER_MEDIA` Offscreen、AudioContext 原声回放和专用 loopback stream。
5. 五种终态都经过 cleanup barrier；Cookiefile、临时媒体、原始音视频、active capture 和私有路径公开计数为 0。
6. V3-2 只产出 `MediaTranscript`；关键帧/OCR/VLM/Outline/Mindmap/Ask/持久任务/导出/V4 未提前承诺。
7. 通用 `MediaAcquirer` 与 B站 plugin 分层清楚；未来门户不得继承 B站权限、Cookie 策略或 PASS。

### 3.2 机器合同

独立执行：

- 两份 Draft 2020-12 Schema meta-validation。
- positive instance 对 acquisition Schema：0 errors。
- 48 requirementId、48 caseId 唯一；映射和 FailureCode 精确一致。
- 12 个 Schema cases 修改后被拒绝。
- 36 个 semantic cases 修改后仍 Schema-valid，并按规格 §10 得到声明 FailureCode。
- positive semantic base 在 mutation 前通过。
- policy FailureCode 与 Schema `NonNullFailureCode` 精确相等。
- segment text hash、content hash 和 acquisition/asr/transcript hash 绑定可复算。
- Revision 2 sample Schema 要求 12 个 production-ready 样本、Chrome>=116、build/dependency/model binding、6/3/1/1/1 计数和三个 completed 120 秒 gold window；不得允许 pending/template 实例冒充。

### 3.3 真实输入与来源边界

- Revision 1 registry 必须仍为 12 个唯一真实 B站 URL，6 subtitle + 3 asr + 1 multipart + 1 restricted + 1 low_signal；它只是 V3-2-0 重探测输入，不是 V3-2 production pass。
- V3-1.3 独立实施出门审查必须确为 PASS、Fatal=0/Major=0；三项 Minor 已进入 V3-2 外审/实施义务。
- BiliNote allowlist 仍为 clean commit `reference_only`，copy 未授权；dirty diff 不得进入 Navia。

### 3.4 Draw.io

- 恰好 8 页中文。
- 每页 ID 唯一、edge source/target 存在、无节点越出 1600x900。
- 人工抽查第 2、4、7、8 页，确认状态、四路线、清理、A01-A20 和出门边界可读，无重复或过度承诺。

## 4. 假绿攻击

至少尝试：

- 只校验 Schema、不执行 semantic rules；
- 让 mutated base 在 mutation 前已失败；
- 把 content hash 错误误归为 ASR 输出错误并掩盖 transcript provenance；
- 跨 task lease/grant/artifact；
- capture 无可信点击、错误 tab、过期或重放 ticket、Chrome<116、多个 Offscreen；
- cleanup receipt 自报通过但时序错误或真实残留；
- 用 revision 1、fixture WAV、Mock、BiliNote 输出、旧 run 或跨 run 拼接计 production；
- 用 pending gold window 或降低 CER/覆盖阈值出门；
- 把 V3-2 transcript 写成画面理解或完整 V3。

## 5. 输出要求

审查报告落盘到权威仓库路径：

```text
docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/
  v3-2-independent-document-audit.md
```

报告必须包含：

1. 19 项 payload hash 结果与 source mapping 结果。
2. Schema/positive/48 case/sample Schema 的独立复算结果。
3. PRD/架构/计划/威胁模型/Draw.io 一致性。
4. Fatal/Major/Minor，逐项给复现与最小修复。
5. 明确决定：`V3-2 DOCUMENT CONDITIONAL GO FOR EXPLICIT USER AUTHORIZATION` 或 `FAIL / REOPENED`。
6. 明确保持：`V3-2 implementation NO-GO`，直到用户在审查通过后另行授权。

## 6. 工作约束

- 只读；不修改主工作树，不 commit/push。
- 不安装 yt-dlp/model，不运行真实下载、ASR、Chrome capture 或产品代码。
- 不打开、复制或打印用户 Cookie；公开包不含 Cookie。
- 不运行旧 PX generator/validator，不改写任何 sealed run。

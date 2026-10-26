# GC-B6 语义复核实施前坐标与决策

日期：2026-10-25

状态：**GC-B6A REVIEW-CAPTURE IMPLEMENTATION MAY START**

## 当前坐标

```text
V3 Chat + Know
-> V3-5.10 Stage B
-> GC-B5R B-5 machine gate: CLOSED (R8, 6/6 complete)
-> GC-B6A private review-capture tooling: MAY START
-> GC-B6B fresh candidate + blind host semantic review: NOT AUTHORIZED YET
-> B-7 independent implementation exit: NOT STARTED
```

B-5 最终机器证据位于：

`docs/active/project/evidence/v3_media_companion/v3-completion/gc-b5r-b5-final-closure-codex-2026-10-25/`

其 manifest 摘要为
`2bcc8124520a04573288ea19fd9de095b6ff9c4fa9fb470446cb4f4b62d57847`。

## 新发现的独立缺口

R8 正确保留了六份 V2.1 derivative、机器收据、任务/来源绑定和清理证明，
但清理后没有留下 B-6 所需的完整派生证据文本与缩略图。Derivative 中只有
evidence ID；没有对应内容时，不能复核事实正确、claim-evidence、截图匹配和
seek。仅阅读 derivative 或根据 BVID 猜测原视频内容会形成假绿。

该缺口不推翻 B-5 的机器门禁结论，但阻止 B-6 开始。由于 evidence ID 含
taskId，OCR/vision caption 还可能非确定，事后重建不能证明是 R8 的原始证据。

## 决策

采用“下一次 fresh candidate 在 durable publication 后、cleanup 前捕获私有
评审包”的路线。私有包只含已授权的派生 transcript/OCR/vision-caption 文本、
冻结 derivative、公共 evidence metadata、真实 PNG 缩略图和 seek 映射；不含
原始视频、音频、Cookie、key、bearer、Provider 响应或私有绝对路径。

为保持评审独立性，拆成两个会话：

1. **GC-B6A**：ClaudeCode 只实现和离线验证捕获器，不启动 Chrome、Runtime
   媒体任务、下载或 Provider。
2. **GC-B6B**：Codex 接受 B6A 后，由新的 ClaudeCode/宿主评审会话完成一次
   fresh 六视频 candidate、私有评审包和盲态语义复核。该会话不得修改工具或
   产品代码。

B6B 结束只形成 `STAGE B IMPLEMENTATION CANDIDATE AWAITING INDEPENDENT B7`。
本主会话参与过 B-5 实现，不能承担 B-7。

合同变更：**none**。

# V3-2-4a Acquisition Orchestration 合同增补

日期：2026-10-07。状态：`FROZEN FOR IMPLEMENTATION`。

## 1. 问题与范围

V3-2-4 已实现 capture grant、Background、Offscreen、PCM sink 与 SenseVoice 接口，但产品没有把当前页面、同 task 凭据租约、前三条路线和可信 capture 串成可达流程。本增补只关闭该编排缺口；不新增门户权限、模型、视觉能力或 V3-3 产物。

## 2. 权威实体

| 实体 | 所有者 | 责任 |
|---|---|---|
| `MediaAcquisitionClient` | Extension `media_companion/acquisition/` | 收集通用 `MediaPageContext`，创建/执行/读取/取消 Runtime task；不调用 B站接口或 ASR |
| `MediaAcquisitionCoordinator` | Runtime | 持有 task、路线顺序、失败投影、终态和 cleanup barrier |
| `BilibiliMediaAcquirer` | Runtime adapter | 解析通用 identity，尝试凭据字幕与当前分 P 媒体；不接触 UI |
| `MediaPortalAdapter` | Content bridge | 提供通用页面 identity、公开字幕能力、播放读取与 seek；不接触 Cookie |
| `TrustedTabCaptureCard` | Side Panel / Workspace | 仅在权威 task 返回三条有序失败后允许可信点击 |

## 3. 固定执行顺序

```text
collect current MediaPageContext
-> establish same-task PortalCredentialLease
-> POST /v1/media/acquisitions
-> POST /v1/media/acquisitions/{taskId}/execute
   -> credentialed_subtitle
   -> credentialed_media_asr
-> if both failed, product checks current MediaPageContext.transcriptAvailability
   -> available: fail closed with V3_MEDIA_PUBLIC_TRANSCRIPT_READER_UNAVAILABLE until a reader exists
   -> unavailable/restricted/unknown: POST the third route failure
-> GET capture eligibility
-> only three ordered failures: render trusted capture action
-> trusted click -> existing one-shot grant -> capture -> SenseVoice
```

`execute` may return `input_acquired` with an acquired subtitle/audio artifact or `awaiting_public_subtitle` with exactly two Runtime-authored failures. For `credentialed_media_asr`, Runtime must also create and start the same-task SenseVoice transcript and return its public task receipt; `input_acquired` alone is not transcript completion. The latter is an execution outcome, not a new Runtime task state: the task remains contract-valid `acquiring` until capture starts or another terminal decision is made. Expected route failure must not put the task in a terminal state. Unexpected contract, identity, authentication or cleanup failures remain terminal/fail-closed.

## 4. Authority Rules

1. Runtime alone authors `credentialed_subtitle` and `credentialed_media_asr` failures.
2. Extension may author `public_or_page_subtitle` failure only after a fresh same-tab `MediaPageContext` observation and only when availability is `unavailable`, `restricted`, or `unknown`.
3. Availability `available` cannot be converted to failure. Until a production public subtitle reader exists, the task remains blocked with `V3_MEDIA_PUBLIC_TRANSCRIPT_READER_UNAVAILABLE` and capture stays hidden.
4. Failure order and exact-one semantics remain enforced by Runtime. Duplicate, reordered, post-terminal and cross-task reports return non-2xx.
5. UI renders Runtime task/eligibility; it never infers eligibility from labels or local arrays.

## 5. Portal Openness

The client consumes only `MediaPageContext.adapterId/mediaId/playbackUnitId/part` and policy metadata resolved from the registered portal session adapter. Bilibili URL, bvid, cid, Cookie names and downloader behavior remain in their adapters. A future YouTube/Xiaohongshu adapter must provide its own page/session/acquirer registrations and cannot inherit Bilibili permissions or evidence.

## 6. 受信任捕获两步协议

Chrome 只允许在扩展操作的真实用户调用上下文中签发 `tabCapture` stream ID。因此捕获不得由普通页面按钮直接模拟为已开始，固定协议为：

1. Workspace/Side Panel 调用 `arm`，Background 绑定 `taskId + tabId + source identity`，但不签发 stream ID；重复或跨 tab arm 拒绝。
2. UI 明确提示用户点击 Navia 扩展操作；Background 在 `chrome.action.onClicked` 或注册命令事件内消费唯一 armed 请求。
3. `startArmed(tab)` 重新核对 active tab、identity 与 one-shot grant，再调用 `chrome.tabCapture.getMediaStreamId`；成功后才创建 Offscreen 捕获。
4. UI 通过 `status` 读取同一 Background 状态；不得用本地计时器推断已开始。
5. `chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:false})` 保证 action click 可由捕获处理器观察；处理完成后再显式打开 Side Panel。

捕获 sink 必须同时证明格式正确和声音非空：`capturedMs > 0`、`nonZeroSampleCount > 0`、`peakAbsSample > 0`。全零 PCM 返回 `V3_MEDIA_CAPTURE_EMPTY`，不得送入 ASR。

## 7. SenseVoice 进程边界

Runtime transcript worker 不得在多线程进程中使用 Python `preexec_fn`。POSIX 下 `NativeAsrProcessHost` 必须启动独立的 `asr_sandbox_launcher.py`，由该单线程 launcher 设置内存上限、CPU affinity 与网络 syscall denylist 后 `exec` 已冻结的 SenseVoice 原生入口。launcher 本身必须是 regular、single-link 文件；Windows 保持无 `preexec_fn` 的直接启动路径。

## 8. Public API Shapes

`POST /v1/media/acquisitions/{taskId}/execute` has no request body. Response data is exactly:

```json
{
  "task": {},
  "outcome": "input_acquired | awaiting_public_subtitle",
  "input": null,
  "failures": [],
  "transcript": "public task receipt or null"
}
```

For `input_acquired`, `input` is the existing public artifact/route receipt and no capture action is shown. For `awaiting_public_subtitle`, `input=null`, failures are exactly the first two ordered routes, and task state remains `acquiring`.

The offscreen capture stop response must retain Runtime's `completed.transcript` receipt until it reaches the initiating Side Panel or Workspace. A missing or malformed terminal payload is `V3_MEDIA_CAPTURE_FINALIZE_FAILED`; the UI must not reset it to an idle capture state. Nonterminal transcript states are displayed as local transcription in progress and are polled through the Runtime task endpoint until a real terminal state is observed.

No endpoint accepts a fault profile, Cookie value, local path, arbitrary URL, ASR model override, or caller-provided first/second route result.

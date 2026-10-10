# V3-2-4a 独立实施出门审查

日期：2026-10-07。审查对象：V3-2-4a acquisition orchestration、trusted tabCapture 与 SenseVoice fallback 冻结候选。审查方式：当前 session 独立只读复算审计包、Schema、公开 tar、成功 run、实现关键路径和当前回归；未读取仓库外 Cookie，未修改成功 run，未运行旧 PX generator/validator。

## 0. 决定

`V3-2-4a PASS`。

- Fatal：0。
- Major：0。
- Minor：3。
- 只允许 V3-2-5 按已通过的文档进入实施前闭环与实现；不得扩大为 V3-2、V3、十二页样本或视频理解完成。

## 1. 载荷与不可变性

| 检查 | 独立结果 |
|---|---|
| 审计包结构 | 18 payload + 1 manifest，平铺 19 文件 |
| 18 项 SHA-256 | 18/18 与 `AUDIT_MANIFEST.md` 一致，0 mismatch |
| capture stream Schema meta | Draft 2020-12 PASS |
| transcript execution Schema meta | Draft 2020-12 PASS |
| source tar | 54 members（含目录项），0 绝对路径、0 `..`、0 Cookie/profile/database/raw-audio 命名 |
| public tar | 4 members（含目录项），3 个公开文件，0 private/Cookie/profile/database/raw-audio 命名 |
| 公开 secret scan | 100 files / 3,961,109 bytes / 0 hit |
| 成功 run | `v3-2-4a-20261007T074401Z`，同一 run 的 result、scan、PNG |

当前 PRD、架构和 stage gate 的包副本包含 Chat/Know 与 V3-1.4 的增量说明；这些增量未修改 V3-2.4a 固定分母、成功 run 或 source tar。

## 2. 七项必查结论

### 2.1 可信捕获调用链

实现为 `arm -> chrome.action/command -> startArmed`。Side Panel 只能准备 task/tab/page capability；真正的 stream ID 由 Chrome 扩展 action 或 command 的用户调用上下文取得。Background 复核 task、tab、page hash 与 one-shot grant，旧 grant、错 tab、跨 task 均 fail-closed。真实 runner 使用 Windows UIAutomation 调用扩展按钮，不是 `evaluate()`、controller 直调或合成 DOM 点击。

结论：PASS。

### 2.2 三路线与 eligibility 权威

路线顺序固定为：

1. `credentialed_subtitle`
2. `credentialed_media_asr`
3. `public_or_page_subtitle`
4. `trusted_tab_capture_asr`

前两项由 Runtime acquisition coordinator 写入；第三项只接受冻结 route 名和 FailureCode；捕获 grant 由 Runtime 对三条失败记录再次判定。UI 不能直接把 task 改成 eligible。

结论：PASS。

### 2.3 非静音 PCM 与真实 ASR

私密 Runtime 日志记录：`capturedMs=16551`、`chunks=194`、`nonZeroSamples=263377`、`peakAbsSample=11525`。成功检查同时要求真实播放、捕获期间播放继续、同 task SenseVoice terminal；静音或空 PCM 不能通过。

结论：PASS。

### 2.4 Native ASR 沙箱

`asr_sandbox_launcher.py` 由单线程子进程设置 address-space rlimit、CPU affinity 和网络 syscall denylist 后 `exec` 冻结程序，避免在多线程 Runtime 使用 `preexec_fn`。模型/可执行文件仍受冻结 identity 约束。

结论：PASS。

### 2.5 单 run、自洽与秘密边界

公开 tar 仅含 `result.json`、`secret-scan.json` 和最终 PNG。没有 Cookie、lease/token、绝对用户路径、Runtime sqlite、Chrome profile、WAV/PCM 或历史失败 run。截图 SHA-256 与 result 一致。失败诊断 run 保留在私密命名空间且未被封入候选。

结论：PASS。

### 2.6 PRD 与门户边界

当前真实正例仅证明一个 B站页面在该时间点完成 trusted capture -> SenseVoice transcript。实现继续通过 `adapterId/sourceIdentity` 和 portal registry 隔离 B站逻辑，没有声称 YouTube/小红书已支持，也没有声称十二页、V3-2-5、V3-2 或 V3 已通过。

结论：PASS。

### 2.7 自动回归

| 门禁 | 结果 |
|---|---|
| 4a 冻结候选自报 Runtime | 561 passed |
| 当前 Runtime 全量（含后续 V3-1.4 增量） | 567 passed |
| 4a 冻结候选自报 Frontend | 44 files / 307 tests passed |
| 当前 Frontend 全量（含后续 V3-1.4 增量） | 44 files / 308 tests passed，exit 0 |
| 当前 media targeted | 90 passed |
| TypeScript | exit 0 |
| production build | exit 0 |
| 真实 Chrome | 12/12 true |

307 与 308 的差值来自候选封存后新增的 V3-1.4 Runtime instance UI 测试；4a source tar 和成功 run 未修改。

## 3. 成功 run 12 项

以下均为 true：`realThreeRouteFailure`、`realDecodedAudio`、`realPlayback`、`extensionInvokedOnTarget`、`trustedCaptureStarted`、`playbackContinuedDuringCapture`、`senseVoiceTerminal`、`noActiveOffscreen`、`noRuntimeMediaResidue`、`profileDeleted`、`secretScanZeroHits`、`secureTaskRootDeleted`。

真实页面：`https://www.bilibili.com/video/BV13W41137qV`。最终截图显示实际 Workspace transcript 完成状态与三路线失败信息；未发现遮挡或秘密信息。

## 4. Minor

- M-1：真实正例仅一个 B站页面。十二页 6+3+1+1+1 固定分母仍属于 V3-2.7。
- M-2：组织独立性有限；当前 session 与实施链共享仓库上下文。V3-2 最终出门仍必须使用新的审查 session。
- M-3：当前全量前端 308 项不是 4a 冻结 source tar 的一部分；审计已分别记录 snapshot=307、current=308，禁止把后续增量回写为 4a 原始证据。

以上均不改变 trusted capture、非静音 PCM、SenseVoice terminal、清理和秘密扫描事实，不阻断 4a PASS。

## 5. 门禁原话

```text
V3-2-4a PASS
Fatal=0 / Major=0 / Minor=3
V3-2-5 may enter preimplementation closure and implementation
V3-2-6 / V3-2-7 / V3-2 / V3 remain NOT PASSED
The original V3 plan, 12-page denominator, and H01..H10 remain unchanged
```

## 6. 下一步

1. 关闭 V3-2-5 实施前审计中唯一的 predecessor Major。
2. 按 `2-5-0..2-5-7` 实现 Runtime 权威产品投影与 Side Panel/Workspace 同 task 体验。
3. 真实 Chrome 必须重新生成 V3-2-5 自己的四视口、Axe、键盘、cleanup、retry 与 secret-scan 证据；4a 截图不能代替 2-5 验收。


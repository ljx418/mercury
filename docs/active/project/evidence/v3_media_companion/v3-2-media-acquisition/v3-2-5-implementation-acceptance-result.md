# V3-2-5 Transcript 产品化实施验收结果

日期：2026-10-08  
决定：`V3-2-5 LIMITED PASS`。本结论只覆盖双容器 transcript 产品管线，不代表 V3-2、视频理解或 V3 通过。

## 1. 权威候选

- run：`v3-2-5-ui-20261007T155715Z`
- 真实页面：`https://www.bilibili.com/video/BV13W41137qV`
- 证据根：`v3-2-5-real-chrome/runs/v3-2-5-ui-20261007T155715Z/`
- 原始结果 SHA-256：`1f8c59558f38427901d62079ef2b5bc5c1429ea8eaaf03c1aa22cabd1ab712fe`
- ProductUiAcceptance SHA-256：`aa2947d63ce24550765021868fb4fd22cbc7f44f4a513cdcabedf3ef610c2762`
- build tree SHA-256：`e414e0adb6be56477de2639ad365b288c9f8b893d7de2f59e0de3c752c0a2a17`

先前失败或不完整尝试均不作为通过依据；只有上述最终 run 是本结论输入。

## 2. A01..A14

| ID | 结果 | 新鲜证据 |
|---|---|---|
| A01 | PASS | 真实 B站页创建唯一 Runtime task，页面、adapter 和当前分 P 由页面 bridge 进入 acquisition |
| A02 | PASS | Side Panel 360/420 与 Workspace 768/1280 均读取同一完成 task，`runtimeTaskRead=true` |
| A03 | PASS | 获取路线、进度、机器原因全部来自 `MediaTranscriptProjection` |
| A04 | PASS | SenseVoice 本机转写真实完成；播放期间取得真实 decoded audio |
| A05 | PASS | 三条路线真实失败后进入 `awaiting_trusted_capture`，未自动 capture |
| A06 | PASS | 本机 UI Automation 激活扩展，真实 trusted capture 启动且视频继续播放 |
| A07 | PASS | 新 cancellation task 显示 cleaning，cleanup 完成后才进入 cancelled |
| A08 | PASS | retry 创建第三个新 taskId；lease/envelope 绑定哈希不同；重试任务最终清理 |
| A09 | PASS | Workspace 展示有序 segment、route、provenance；未提前提供 seek |
| A10 | PASS | 终态文案由 Runtime 闭集状态产生，无伪 transcript 或完成声明 |
| A11 | PASS | reload/双容器按 taskId 或 sourceIdentity 从 Runtime 恢复，不使用 localStorage 事实源 |
| A12 | PASS | 360/420/768/1280 四视口 `rootOverflow=false` |
| A13 | PASS | 四视口 Axe serious/critical=0；键盘主入口通过 |
| A14 | PASS | Draft 2020-12 meta/instance 均通过；扫描 105 文件、4,207,449 bytes、0 hit |

固定五态为 `acquiring -> awaiting_trusted_capture -> transcribing -> cleaning -> terminal`；`capturing` 另由 trusted capture 检查证明，不篡改冻结 Schema 分母。

## 3. 回归

- Runtime：`573 passed in 80.77s`，命令 `PYTHONPATH=. pytest -q`。
- Frontend：`45 files / 311 tests passed`。
- Frontend typecheck：PASS。
- WXT production build：PASS，3.71 MB；仅保留既有大 chunk warning。
- `git diff --check`：PASS。
- `v3_media_transcript_exit_v1.schema.json`：meta PASS，ProductUiAcceptance 0 errors。

## 4. 清理和隐私

- offscreen document：0 active。
- media task / ASR task 文件：0 residual。
- 临时 secure root与 Chrome profile：已删除。
- Cookie、ticket、revocation token、绝对路径未进入公开材料。
- `leaseId:envelopeId` 只在运行时 DOM 作同 run 比较，公开结果只保存 SHA-256。


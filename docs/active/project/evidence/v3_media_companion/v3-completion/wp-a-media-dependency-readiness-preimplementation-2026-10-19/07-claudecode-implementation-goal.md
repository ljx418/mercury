# ClaudeCode CLI Goal：WP-A 媒体依赖就绪

本文件是门禁通过后的一键实施提示词。只有 Codex 最终交接明确写出 `V3 post-R7 / WP-A / IMPLEMENTATION MAY START` 时才使用。在 `/mnt/c/workspace/navia` 工作；只实施 WP-A，完成后停在 `WP-A AWAITING CODEX CHECKPOINT`。

## 必读

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`，尤其 5.1
3. `docs/active/project/01-prd.md` 18.12
4. `docs/active/project/design/v3-media-companion-risk-adr.md` ADR-V3-13
5. 本目录 `00` 至 `06`
6. 三个 `docs/active/project/contracts/v3_media_dependency_*_v1.schema.json`
7. `docs/active/project/design/wp-a-media-dependency-readiness-prototype/index.html`
8. `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0-contract-dependency-samples/dependency-manifest.json`

## 实施目标

按 `04-development-plan.md` 的 A0-A7 顺序实现：Runtime `MediaDependencyManager`、内容寻址 managed versions、固定 catalog、单 repair job、取消/提交竞争、重启清理、原子发布、verified generation/task lease；四个认证 loopback API；Extension 严格客户端和 `MediaDependencySettingsPanel`；acquisition、视觉和 ASR 三条生产路径在任务启动时绑定同一 snapshot。SenseVoice 必须委托既有 `AsrModelManager`。`ffmpeg/ffprobe` 只验证；只允许安装冻结 `yt-dlp 2026.08.19`。

先补测试再实现。A01-A24 必须逐项有“生产调用路径、测试驱动、oracle、负例、清理”证据。实现内循环只跑定向测试；整个工作包稳定后只执行一次集中回归。

## 禁止

- 不修改 WP-A 目标、固定 URL/长度/SHA、验收分母或历史证据。
- 不接受客户端 URL/path/hash，不执行 apt，不下载任意版本，不静默自更新。
- 不实现本地文件导入，不升格或重跑 tabCapture，不进入 WP-B/WP-C。
- 不改变 Cookie、Provider、媒体上传、SourceAuthority、relay v11 或现有 acquisition 公共合同。
- 不读取或输出桌面密钥/Cookie，不把绝对私有路径、凭据、原始媒体写入公开证据。
- 不 commit/push/reset/clean/checkout/revert，不覆盖既有 dirty worktree。
- 测试不得播放声音；真实 Chrome 必须先通知用户、使用 owned profile 和 `--mute-audio`，并尽量避免窗口和焦点。A23 优先无浏览器；A24 优先无窗口产品 API。

## 验证与证据

按 `04-development-plan.md`“固定命令”原样运行：文档 verifier；三个 Runtime 新测试文件；Runtime focused；两个 Extension 新测试文件；Extension media subtree；typecheck；build。实现并运行 `services/local-runtime/scripts/v3_media_dependency_wp_a_probe.py`：A23 用 owned 临时 managed root fresh 安装并验证冻结 URL/size/hash/self-test；A24 固定 `BV1Bb411w741/CID 61744125/p1`，必须经产品 API、生产 factory/acquirer 和 SenseVoice，禁止直调或伪造成功。所有进程、端口、临时文件和 profile 在 finally 清理。

在 `docs/active/project/evidence/v3_media_companion/v3-completion/wp-a-media-dependency-readiness-implementation-2026-10-19/` 写：phase receipt、changed files + SHA、全部命令/退出码、A01-A24 case results、PRD review、secret/cleanup、handoff、payload manifest。报告公共/内部合同变化、真实 task/run id、Fatal/Major/Minor 和剩余风险。

任一 Fatal/Major、合同需扩张、冻结来源不匹配、A23/A24 无法真实证明或需可见 Chrome 但尚未获用户安排时，如实写 `WP-A NO-GO` 并停止。全部完成也不得宣布 WP-A/V3 PASS；写 `WP-A AWAITING CODEX CHECKPOINT` 后停止，等待 Codex 单次复核，不进行独立文档外审。


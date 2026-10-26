# WP-A 开发计划

## 顺序

1. **A0 合同门禁**：先让 schema、fixture 和文档 verifier 全绿；禁止先写产品后追合同。
2. **A1 Runtime manager**：实现 catalog、状态聚合、四项验证、内容寻址版本目录、generation/lease、单 repair job、取消/提交竞争和重启清理。
3. **A2 API 与客户端**：新增四个认证 loopback 路由及严格 TS 类型；拒绝多余字段、URL/path/hash 和非法 job id。
4. **A3 Settings 体验**：实现五种状态、真实进度、取消、失败分类和 Runtime 离线恢复；装配在既有 ASR 设置附近。
5. **A4 任务接线**：`execute_media_acquisition` 在 route 前绑定一次 snapshot；acquisition downloader、视觉 downloader resolver、transcript provider factory 共用该对象和 task lease，运行中不热切换。
6. **A5 故障矩阵**：覆盖来源、长度、摘要、空间、权限、自检、取消、并发、重启、旧 ready 保留、system tool/ASR 缺失。
7. **A6 真实工具验证**：在本轮 owned 临时 managed root 走一次冻结下载/校验/自检；验证系统工具和 ASR 委托状态。网络失败如实 NO-GO，不替换 URL。
8. **A7 单路径证明**：依赖 ready 后，以现有受支持会话做一次受控下载到本地 ASR 的真实无声运行；优先无窗口。确需 Chrome 时先通知用户，集中一次且显式 `--mute-audio`。

## 固定命令与验证预算

实现者新增并维护以下入口；文件不存在时先按计划创建，不能换成只检查字符串的测试：

```bash
python3 docs/active/project/evidence/v3_media_companion/v3-completion/wp-a-media-dependency-readiness-preimplementation-2026-10-19/08-verify-document-package.py
(cd services/local-runtime && .venv/bin/pytest -q tests/test_v3_media_dependency_manager.py tests/test_v3_media_dependency_api.py tests/test_v3_media_dependency_task_binding.py)
(cd services/local-runtime && .venv/bin/pytest -q -k "media_dependency or yt_dlp or sensevoice or media_acquisition")
(cd apps/chrome-extension && npx vitest run src/modules/media_companion/settings/MediaDependencySettingsPanel.test.tsx src/modules/media_companion/tests/MediaDependencyRuntimeClient.test.ts --maxWorkers=2)
(cd apps/chrome-extension && npx vitest run src/modules/media_companion --maxWorkers=2)
(cd apps/chrome-extension && npm run typecheck)
(cd apps/chrome-extension && npm run build)
```

- 编辑内循环只跑受影响测试。
- A1-A5 完成后集中执行一次 Runtime focused、Extension media subtree、typecheck、build、合同 verifier。
- A6-A7 完成后由 Claude 交付 `AWAITING CODEX CHECKPOINT`，不得自行跑阶段 closeout 或独立外审。真实探针必须形成独立脚本 `services/local-runtime/scripts/v3_media_dependency_wp_a_probe.py`，参数固定、输出脱敏 JSON，不能靠临时 shell 拼接成功结果。
- Codex 只做一次 WP-A checkpoint；除非出现新公共合同/安全边界风险，不追加重复外审。

## 退出效果

用户能在分析前知道本机是否能处理无字幕视频；缺失 yt-dlp 时一次修复；系统工具或 ASR 问题有明确下一步；日常任务无需额外操作。失败不会触发隐式 capture，也不会损坏旧的可用工具。


# WP0 R6 限定纠偏收据

## 状态

`R6 CORRECTIVE - 58/65，等待下一次单窗口 G2 正控`

R6 未通过，不进入 R7。本轮接管并核验 ClaudeCode 的 58/65 结果，发现 G2 驱动器存在不可采信的占位证据；G1 29、G3 8、G4 21 保持可采信，G2 计为 0/7。

## 修正内容

- 修复 G2 acquisition identity tuple：`partId` 与每个 `sourceIdentity` 对齐。
- 用真实 Runtime coordinator 建立场景前置状态，不直接写数据库、grant、ticket 或 sink。
- 删除 G2 的固定错误码、空 stop 和未实际触发的 arm 占位逻辑。
- owned Runtime 改为在真实扩展 ID 确定后启动；Chrome 仍固定 `--mute-audio`。
- 原生 action 改用仓库既有 owned-PID 调用器，派发失败立即报错；状态超时后通过产品 stop 路径清理，避免后续 `ALREADY_ACTIVE` 级联。
- RLY11-N07 命中启动后协议边界；N18 使用精确 `RUNTIME_DISCONNECTED`；N22 驱动真实 cleanup timer 并使用 `CLEANUP_INCOMPLETE`。

## 可见运行结论

本轮此前只执行一次 owned Chrome：真实扩展、真实 B 站页、真实 Side Panel 与 owned Runtime 均启动成功，但自制快捷键派发未触发 controller。N01 超时，N02 被前一场景的 armed 状态污染，其余场景未启动。该次运行不计通过。

定位后只做离线修正；遵守单干扰窗口约束，没有执行第二次可见 Chrome。

## 合同

公共合同变化：`none`。

内部行为纠偏：ACK 超时映射为既有冻结码 `V3_MEDIA_CAPTURE_RUNTIME_DISCONNECTED`；cleanup 超时映射为既有冻结码 `V3_MEDIA_CAPTURE_CLEANUP_INCOMPLETE`。v11 schema、fixture、40/20 inventory、阈值与消息集合均未改变。


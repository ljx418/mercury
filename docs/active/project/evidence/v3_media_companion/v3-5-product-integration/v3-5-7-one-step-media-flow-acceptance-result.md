# V3-5-7 侧边栏一键媒体流程验收结果

日期：2026-10-09。真实 run：`v3-5-7-smoke-20261009T142712Z`。固定样本：`https://www.bilibili.com/video/BV1ZpYd66ELP`。

## 决定

`LIMITED PASS FOR ALREADY-GRANTED DAILY FLOW`。

- Fatal：0。
- Major：0（限定已完成一次授权的日常路径）。
- Minor：2。
  - M-1：首次安装的嵌入式 Side Panel 不能稳定直接显示 Chrome optional-permission 弹窗；首次授权仍需顶层扩展页面或浏览器原生入口承接，不能把本次已授权 run 扩大为首次启用已闭环。
  - M-2：本次最小真实冒烟没有重跑四视口与 Axe；相关样式有单测和既有 V3 回归支撑，但 A09 保持 Pending。

## 固定门槛结果

| ID | 结果 | 真实证据 |
|---|---|---|
| A01 | PASS | 统一 `MediaCompanionLaunchCard`；未授权态只有一个媒体主动作，Runtime、租约和刷新按钮不再并列出现 |
| A02 | PARTIAL | 顶层扩展页面可完成 Chrome permission；嵌入式 iframe 的首次弹窗未稳定成立，不作通过声明 |
| A03 | PASS | 已授权 profile 打开真实 B站页后自动建立 Runtime session、credential channel/lease 并创建 acquisition |
| A04 | PASS | UI 从侧栏打开直接进入 `processing`，未显示 `V3_MEDIA_POLICY_NOT_GRANTED` |
| A05 | PASS | Runtime 异常态只保留一个“重新尝试”动作，底层连接按钮隐藏 |
| A06 | PASS（边界明确） | 正常样本通过 `yt-dlp` 进入 processing；只有三条机器路径均失败时才显示 trusted capture，未伪造 Chrome `activeTab` 用户手势 |
| A07 | PASS | 授权用途、Runtime 状态与撤销入口收纳于折叠设置；公开/私有/临时目录扫描 0 secret hit |
| A08 | PASS | 自动启动受页面、授权版本和 in-flight guard 约束；真实日志只创建一个当前 acquisition |
| A09 | PENDING | 本轮未用新组件独立重跑四视口与 Axe，不借用旧 run 冒充 |
| A10 | PASS（当前范围） | typecheck、E2E build 已通过；相关 7 文件 65/65 tests PASS；旧 V2 production validator 未运行 |

## 真实运行事实

`public/result.json` 报告：

- `onePrimaryEntry=true`
- `noManualRuntimeConnect=true`
- `noManualCredentialStart=true`
- `noManualConsentRefresh=true`
- `autoFlowReachedMediaState=true`
- `noPolicyFailureVisible=true`
- `reached=processing`
- `profileDeleted=true`
- `secureTaskRootDeleted=true`

secret scan 覆盖 101 个文件、45,053,896 bytes，`hitCount=0`。Runtime 日志证明 session、credential channel、credential lease、acquisition 均由产品 UI 自动触发，未直接调用后端跳过 UI。

## 测试说明

- 相关回归：7 files / 65 tests PASS。
- 全量 `npm test -- --run` 在运行首个旧 V2 production validator 时长期占用单核且无完成结果，已终止；按阶段门禁不把旧 validator 的未完成运行计作 V3-5-7 失败或通过。
- 真实 run 目录：`docs/active/project/evidence/v3_media_companion/v3-5-product-integration/v3-5-7-real-chrome/runs/v3-5-7-smoke-20261009T142712Z/`。


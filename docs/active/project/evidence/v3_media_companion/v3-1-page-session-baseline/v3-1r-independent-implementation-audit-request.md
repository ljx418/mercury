# V3-1R / V3-1.2 实施出门独立审查请求

日期：2026-09-17。审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`。

## 1. 决策对象

请独立复核 V3-1R 是否在不修改产品合同、不缩小冻结 12 页分母、不泄露用户会话、不把登录态证据冒充匿名事实的前提下，关闭 V3-1.2-A13。

候选结论：

```text
V3-1.2 LOCAL PASS CANDIDATE
Fatal=0 / Major=0 / Minor=0
Independent implementation exit audit: PENDING
V3-1.3 implementation: NO-GO
```

## 2. 必须独立复核

1. 重算 19 个载荷 SHA-256，并与 manifest 逐项对账。
2. 审查 collector/verifier：登录态只能由显式 env 开启；默认匿名分支保留；Cookie 只允许冻结九名与 B站域；不得输出名称列表、值或文件路径。
3. 从 `19-public-evidence.tar.gz` 隔离解包，重算 build tree、sample registry、portal registry、result、verification 和 secret scan 绑定。
4. 验证同一 run 的 12 个 URL/sampleId 唯一，分类精确为 6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low-signal；不得引用历史 run 补足。
5. 验证服务端输入只有 HTTP/code/isLogin，且为 200/0/true；证据不得含 UID、昵称或响应正文。
6. 解码 12 张 PNG，均为 1280x900；核对每项 `privacyCapture` 为 1280x1000 来源、y=100/height=900 裁剪；视觉抽样确认没有 B站顶部账户栏。
7. 独立扫描平铺包、解包 build 与 run：不得存在原始会话值、Cookie header、Bearer token 或桌面授权文件路径。不得在报告中打印任何疑似秘密值。
8. 验证 ordinary page 0 静态注入、p2 identity、真实 playback/seek、非法 seek fail closed、0 page error、profile/Chrome/临时媒体清理。
9. 核对 230 tests、typecheck、build、Route A 13/13 的声明与现有日志/机器结果边界；不能把未亲自重跑的命令写成独立实跑。
10. 对照 PRD/架构判断该修复是否只恢复回归证据，未进入 V3-1.3 envelope/lease、V3-2 下载/ASR，未声称 YouTube/小红书已实现。

## 3. 防假绿拒绝项

出现以下任一项必须判 Major：跨 run 拼接；删减样本；把匿名历史结果作为当前结果；登录全页截图写盘；raw Cookie value 命中；产品读取桌面文件；build hash 不可复算；verifier 只信任 `passed=true`；V3-1.3 代码已被顺带实现；外审包 hash 不匹配。

## 4. 输出要求

请把报告写入：

`docs/active/project/evidence/v3_media_companion/v3-1-page-session-baseline/independent-v3-1r-implementation-exit-audit.md`

报告需列出 Fatal/Major/Minor、逐项复算结果、截图隐私抽样、剩余风险和门禁原话。只有 Fatal=0/Major=0 才允许将 V3-1.2 升级为限定 PASS，并进入 V3-1.3 文档/威胁建模阶段；不得直接批准 V3-1.3 代码实施。

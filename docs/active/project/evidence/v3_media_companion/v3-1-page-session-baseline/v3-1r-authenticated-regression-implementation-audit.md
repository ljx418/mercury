# V3-1R 登录态真实站点回归内部实施审计

日期：2026-09-17。结论：`INTERNAL PASS FOR INDEPENDENT EXIT AUDIT`。Fatal=0、Major=0、Minor=0。

## 1. 修改边界

仅修改 V3 页面回归基础设施：

- `apps/chrome-extension/e2e/v3-media-page-collector.mjs`
- `apps/chrome-extension/e2e/v3-media-page-verify.mjs`

未修改 Extension 产品模块、manifest 权限、Runtime、API、portal/session registry、合同 Schema 或冻结样本注册表。

## 2. 实现核查

1. 登录态模式只能由 `NAVIA_V3_AUTHENTICATED_REGRESSION=1` 显式开启；默认仍是匿名证据类。
2. 输入只接受冻结九名、非空且属于 B站域的 Cookie；值只保留在当前 Node 进程内存。
3. 注入发生在新建 disposable Chrome context，先由 B站 nav 验证 HTTP/code/isLogin，再采集同一 run 的 12 页。
4. 字幕样本只允许当前页面 bridge/WBI 返回 `available`；短暂加载态可重试，但不能引用旧 run。
5. 登录态截图固定裁切页面顶部 100px，并写入可复算的 source viewport、clip 和 output 元数据。
6. collector 与 verifier 均对 run+build 扫描原始 Cookie byte needles；输出只含扫描数量与命中数量。
7. verifier 不信任 collector summary，独立复算 registry/build hash、身份、分类、PNG 尺寸、裁剪、清理和秘密扫描。
8. 预外审包自检发现 harness 曾含本机授权文件默认路径；已改为必须显式提供环境变量，旧候选降级并重新采集，含路径的授权原文不进入外审包。

## 3. 真实数据与回归

- B站服务端登录态：HTTP 200、code=0、isLogin=true。
- 冻结矩阵：12/12；6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low-signal。
- verifier：18/18；0 page error；12 PNG hash/尺寸通过。
- 工具链：230 tests、typecheck、build、Route A 13/13。
- 清理：profile 删除、Chrome 关闭、临时媒体 0。
- 原始秘密：0 命中。

## 4. PRD 与风险

该修复恢复 V3-1.2 对既有页面适配的真实站点回归，不新增用户功能。证据类别明确反映平台字幕现需登录态，不把会话种子描述为匿名公开能力，也不把 harness Cookie 注入迁移进产品。

剩余高风险边界不属于本实现：V3-1.3 的 Browser 到 Runtime 秘密传输、一次性 envelope、lease、replay、redaction 和下载授权。它们在独立实施授权前保持 NO-GO。

## 5. 内部决定

V3-1R 可提交独立实施出门审计。只有外审 Fatal=0/Major=0，才可把 V3-1.2 从本地候选升级为限定 PASS，并进入 V3-1.3 实施前文档阶段。

# V3-1R 登录态真实站点回归重绑定验收计划

日期：2026-09-17。状态：`FROZEN FOR IMPLEMENTATION`。

| ID | 操作 | 必须结果 |
|---|---|---|
| V3-1R-A01 | 启动显式登录态回归模式 | 默认匿名模式不变；本 run evidence class 精确为 `user_authorized_live_session_seed_regression` |
| V3-1R-A02 | 读取用户授权会话输入 | 只接受冻结九名且全部属于 B站域；不输出值、名称列表或文件路径 |
| V3-1R-A03 | 访问锚点并请求 nav | HTTP 200、code=0、isLogin=true；结果不含 UID/昵称/正文 |
| V3-1R-A04 | 顺序访问冻结 12 页 | 12 URL/12 sampleId 唯一；identity 与 revision 1 registry 一致 |
| V3-1R-A05 | 检查 6 个字幕样本 | 六项均 `transcriptAvailability=available`；只能来自当次页面/WBI 事实 |
| V3-1R-A06 | 检查 3 ASR、受限、多 P、低信号 | 锚点不得字幕假阳性；受限、p2 identity、seek 和非法 seek 行为保持 |
| V3-1R-A07 | 截取 12 张页面证据 | 每张 1280x900；由 1280x1000 viewport 排除顶部 100 px；0 账号顶栏 |
| V3-1R-A08 | 普通页 Route A 回归 | 0 静态 bridge/launcher/sidebar |
| V3-1R-A09 | 原始值秘密扫描 | run + build 全文件按原始值 needle 扫描 0 命中；名称模式扫描 0 命中 |
| V3-1R-A10 | 清理 | Chrome 关闭；disposable profile 删除；0 临时媒体 |
| V3-1R-A11 | 独立 verifier | 所有固定检查 PASS；不得只信任 collector `passed=true` |
| V3-1R-A12 | 工具链与 PRD 检视 | 230+ tests、typecheck、build、Route A 13/13；0 产品合同或权限漂移 |

出门条件：A01..A12 全部 PASS，Fatal=0、Major=0。通过后只关闭 V3-1.2-A13，并允许进入 V3-1.2 实施后独立审计；不直接批准 V3-1.3。

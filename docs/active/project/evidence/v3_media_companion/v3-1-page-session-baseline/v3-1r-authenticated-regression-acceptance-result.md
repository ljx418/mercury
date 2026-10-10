# V3-1R 登录态真实站点回归验收结果

日期：2026-09-17。状态：`LOCAL PASS CANDIDATE / INDEPENDENT EXIT AUDIT PENDING`。

## 1. 权威输入

- run：`v3-1r-authenticated-regression-20260917T180000Z-final`
- result SHA-256：`c444c48b16d2070e161513455e45a2e7019f5ce0cd4168430c35e53619e1b851`
- acceptance verification SHA-256：`3a7d7fd42e9d524b28b68d5a134871cedc33f882a357f99709b039264c96b84f`
- secret scan SHA-256：`96d1b9f4f6da189f7011e0351d3cc4b9fc0b06f78f09cd61be33ed72e3f10ce8`
- build tree SHA-256：`a45963f199555195a4974a74482637f851412366d03ff51f424d9925fc4f1ca4`
- sample registry SHA-256：`b71588928db4a0cb371152999052ae6b511b076377df427d74e680119491d8c1`
- portal registry SHA-256：`c96ab0d356851a7f444b7a3cb01e51c5d5012f564a929277151352bf9868eab6`

Cookie 原始值、账号标识、昵称和授权文件路径均不属于证据载荷。

## 2. 固定验收结果

| ID | 结果 | 实测事实 |
|---|---|---|
| V3-1R-A01 | PASS | 显式模式生成 `user_authorized_live_session_seed_regression`；默认匿名分支仍存在且未改变产品代码 |
| V3-1R-A02 | PASS | 只接受冻结九名与 B站域；证据只记录 count=9，不记录名称列表、值或文件路径 |
| V3-1R-A03 | PASS | nav HTTP 200、code=0、isLogin=true；结果不含 UID、昵称或响应正文 |
| V3-1R-A04 | PASS | 原 revision 1 的 12 URL、12 sampleId 单 run 完成；adapter revision、mediaId、playbackUnitId 与同页事实一致 |
| V3-1R-A05 | PASS | 6/6 字幕样本均为 `available`，最大采集尝试次数为 1；未读取历史字幕载荷 |
| V3-1R-A06 | PASS | 3 ASR、1 multipart、1 restricted、1 low-signal 均符合冻结分类；锚点无字幕假阳性；p2/seek/非法 seek 通过 |
| V3-1R-A07 | PASS | 12 张 PNG 均独立解码为 1280x900；来源 viewport 1280x1000，统一裁掉顶部 100px；视觉抽检无账户顶栏 |
| V3-1R-A08 | PASS | 本地普通页 0 bridge、0 launcher、0 sidebar |
| V3-1R-A09 | PASS | collector 扫描 run+build 107 文件、9,879,334 bytes，原始值与凭据模式 0 命中；verifier 复扫 0 命中 |
| V3-1R-A10 | PASS | Chrome 关闭、disposable profile 删除、临时媒体残留 0 |
| V3-1R-A11 | PASS | 独立 verifier 18/18 PASS，Fatal=0、Major=0 |
| V3-1R-A12 | PASS | 32 test files / 230 tests、typecheck、E2E build、Route A 13/13 全部通过；重建后 build tree 与 run 绑定一致 |

## 3. 防假绿结论

- 没有替换或缩小 12 页分母，没有跨 run 拼接旧字幕结果。
- 登录态仅进入验收 harness 的一次性 profile；产品不读取桌面文件，也未新增 Runtime、下载或凭据租约。
- `production_candidate` 与 `user_authorized_live_session_seed_regression` 两层证据类别同时存在，未冒充匿名公开回归或人工登录路径。
- 截图裁剪发生在浏览器截图 API，原始全页截图未写盘。
- 重新 build 后 verifier 仍通过，排除了“先采集旧 build、后验收新 build”的错绑。

## 4. 门禁

本地判定：Fatal=0、Major=0、Minor=0。V3-1.2-A13 已形成可独立复核的关闭候选。

在新的独立实施出门审计完成前，不声明 V3-1.2 最终 PASS；不进入 V3-1.3 代码。V3-1.3 Browser 到 Runtime 的 envelope/lease 仍需单独文档、威胁模型、外审和用户高风险授权。

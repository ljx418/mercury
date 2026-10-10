# V3-2-2 Route B 实施出门候选审计

日期：2026-10-06。性质：实施代理内部候选审计，不具备组织独立性。

## 变更边界

新增 portal-neutral acquisition contracts、Bilibili adapter、强类型字幕 resolver、固定哈希 yt-dlp/ffmpeg downloader、任务私有 staging、coordinator 输入获取、Revision 4 registry/runner/verifier/sealer。生产 API 未增加 fault 字段、环境变量或设置入口；故障 wrapper 只位于 acceptance runner。

## 验证结论

真实 run 事实、20/20 verifier、441 Runtime、293 frontend、typecheck/build、69 focused、0 fault reachability、0 注册凭据泄漏和 0 cleanup residual 均已落盘。首轮旧样本平台漂移被 fail closed，替代样本经独立文档审查 Fatal=0/Major=0 后才重跑，未跨 run 拼接。

## 风险

1. 公开包按隐私策略不含三份媒体字节；媒体 hash 的独立复验需要重新下载，不可仅靠公开包复算。
2. B站平台 API、字幕与风控可继续漂移；adapter 必须 fail closed，不得放宽 host/identity/lease。
3. Extension production build 有既存大 chunk warning，不是本阶段行为回归。

内部判定 Fatal=0 / Major=0 / Minor=1（媒体 bytes 不公开导致外审只能审计运行时 hash 链或重跑）。请求独立审查决定是否接受 V3-2-2 LIMITED PASS。

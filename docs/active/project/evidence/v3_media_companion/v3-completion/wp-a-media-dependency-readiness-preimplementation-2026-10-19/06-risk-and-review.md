# WP-A 风险闭环与内部审查

## 风险

| 严重度 | 风险 | 文档闭环 |
|---|---|---|
| Major | 任意下载源或客户端注入路径 | POST body 只允许 `dependencyIds`; catalog 冻结 URL/长度/摘要 |
| Major | 文件存在即 ready | 版本、摘要、运行参数、自检、ASR effective id 共同组成 snapshot |
| Major | 失败安装覆盖旧工具 | 私有暂存、原子发布；失败/取消只删暂存 |
| Major | 安装完成热切换运行中任务 | execute 起点绑定 immutable generation |
| Major | 重复 owner/并发下载 | 单 manager、单活动 job、固定 JOB_ACTIVE |
| Major | generation 只冻结名字、不冻结实际资源 | 内容寻址 managed 版本、task lease、三条生产路径共享 snapshot；system 运行前复核 |
| Major | 取消与原子提交竞争造成半发布 | commit lock；installing 不可取消；A12/A17 在提交前后注入 |
| Major | UI 假进度或笼统错误 | job sequence/bytes 驱动；固定分类恢复文案 |
| Minor | ffmpeg 缺失无法一键修复 | 首版诚实提示修复本机伴侣，不静默 apt |
| Minor | fresh 网络验收受外部环境影响 | 失败写 NO-GO；不换 URL、不用旧文件冒充 fresh |

## 三轮内部审查

1. **规格审查**：PRD 18.12、ADR-V3-13、原型、API 和 24 项矩阵范围一致；WP-B/WP-C 未混入。
2. **架构审查**：所有新增实体有唯一 owner；ASR 状态机不重复；API 无秘密和私有路径；任务 generation 边界明确。
3. **假绿审查**：真实安装与真实媒体路线分别设门禁；测试必须驱动生产 manager/factory；当前本机已安装资产不能替 fresh 安装。

首轮隔离审查发现 5 个 Major：资源快照生命周期、取消/重启、API envelope 与负例、下载资源策略、逐项验收不足。它们在 02/03/04/05、三个 schema 和 verifier 中作为单批修订。复审判定 M1/M4/M5 CLOSED；遗留 M2/M3 与两个 Minor 经定向修订后由隔离 Codex 确认 `FOCUSED CLOSURE PASS / Fatal=0 / Major=0 / Minor=0`，verifier `42/42`。不再追加完整文档外审；下一门限是 ClaudeCode 实施后的一次 Codex checkpoint。文档通过不等于产品通过。


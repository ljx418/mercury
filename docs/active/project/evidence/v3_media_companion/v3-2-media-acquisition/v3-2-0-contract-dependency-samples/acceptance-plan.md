# V3-2-0 合同、依赖与生产样本冻结验收计划

日期：2026-09-18。固定分母 D01..D10，无 N/A。

| ID | 操作 | 必须结果 |
|---|---|---|
| D01 | 执行合同审计器 | Schema meta PASS；positive 0 error；49/49 mutation PASS；13 schema + 36 semantic；FailureCode 闭集相等 |
| D02 | 对照 WXT 与目标权限合同 | 当前基线和目标 delta 明确；只新增 `offscreen/tabCapture`；Cookie/B站 host 仍 optional；0 全站权限 |
| D03 | 隔离安装 yt-dlp | exact stable 版本、官方来源、license、wheel/entrypoint SHA-256 完整；无自更新/插件/config/exec |
| D04 | 探测 ffmpeg/ffprobe | exact version/hash/codec 清单完整；后续网络输入 deny 能由 argv/policy 实施 |
| D05 | 探测 faster-whisper | 版本与 Python 环境冻结；cloud upload 不存在；CPU/int8 profile 可初始化 |
| D06 | 冻结 small 模型 | 精确仓库 revision、文件清单/hash、license 完整；网络关闭后受控 cache 可加载 |
| D07 | 真实 Chrome 重探测 12 URL | 新 run、新 profile、12 唯一 identity；目标分类 6+3+1+1+1；每项 evidence path/hash 存在 |
| D08 | 准备并双审 comparison window | 3 个不同 ASR 样本各 120 秒、各 8 个 15 秒 bin；small/base 输出完成；两位独立人类 reviewer 共 48 项判断并完成分歧复核；未签署时状态只能 pending |
| D09 | 秘密与路径扫描 | 私有输入只在 harness；公开材料 Cookie/path/profile/token/stream ID 0 hit；临时 profile/process 清理 |
| D10 | PRD 与阶段门禁复核 | 未实现项不误标；V3-2-0 只冻结输入；Fatal=0/Major=0 才允许 V3-2-1 规划审计 |

## 证据规则

每项记录 expected、actual、command/runner、exit code、artifact path、raw SHA-256 和产生时间。真实 Chrome 与网络结果不能由 fixture 替代；依赖 hash 必须绑定原始字节，不接受版本字符串单独证明。D08 的机器材料由 Agent 生成，人类只比较并标错；两名 reviewer 与 adjudicator 的签署仍是高风险门槛，自动化代理不得代签。

## 失败处理

D01-D10 任一失败即 V3-2-0 `FAIL/REPLAN`。平台样本漂移必须回文档评估替换样本，不能缩分母；模型质量不在本子阶段宣称，不能用下载成功代替 ASR 质量通过。

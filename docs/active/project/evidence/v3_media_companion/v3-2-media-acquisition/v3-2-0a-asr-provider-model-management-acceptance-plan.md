# V3-2-0a ASR Provider 与模型管理验收计划

日期：2026-09-21。状态：`LOCAL LIMITED PASS`。独立实施出门审查为 `Fatal=0 / Major=0 / Minor=3`。固定分母 `V3-2-0a-A01..A16`，不得 N/A 或缩分母。

| ID | 用户场景与操作 | 必须结果 |
|---|---|---|
| A01 | 校验 Schema、positive 和 negative fixtures | Draft 2020-12 meta PASS；所有声明结果一致 |
| A02 | 首次启动发布构建 | bundled tiny 自动为 ready；无需网络、按钮或管理员权限 |
| A03 | 打开 Settings > 媒体与语音 | 显示 requested/effective、fallback、CPU/RAM/显存/磁盘、质量定位 |
| A04 | 选择 ready 模型 | 设置持久化；重启后保持；effective 与请求一致 |
| A05 | 选择未安装模型 | 不静默切换；UI 提示安装；effective 明示 tiny fallback |
| A06 | 点击安装 allowlisted 模型 | 只使用目录内固定 URL/revision/files/hash；阶段顺序完整 |
| A07 | 观察安装弹窗 | 显示真实 bytes/total/percent/speed/ETA、当前阶段、模型名和取消 |
| A08 | 安装完成 | 全文件 hash 正确、自检通过、staging 原子发布、状态 ready |
| A09 | 下载中取消 | 任务 cancelled；临时字节清理；现有 ready 版本不变 |
| A10 | 注入断网/404/截断/hash 错误/磁盘失败 | failed 或 corrupt；不得 ready；显示可执行恢复步骤 |
| A11 | 自动下载失败后导入 `.navia-asrpack` | 合法包成功；错误 model/revision/hash、zip-slip、超限全部拒绝 |
| A12 | 卸载当前或 fallback 模型 | bundled tiny 禁卸载；当前可卸载模型先切 tiny并明确原因；无孤儿任务 |
| A13 | API/静态边界 | Extension 无下载源/模型路径访问；客户端 URL/hash/path 被拒绝；目录 closed-set |
| A14 | 低资源真实运行 | 限定 8 cores/8 GiB/no GPU；tiny 加载和真实短音频推理通过；峰值 RAM <=2 GiB |
| A15 | 前端 E2E | 360/420 Side Panel 和 768/1280 Workspace 无根溢出；键盘可选、安装、取消、导入；Axe serious/critical=0 |
| A16 | PRD/证据/假绿审查 | tiny 不计 A06；small 仍标未通过；qualification_required 不可安装；Fatal=0/Major=0 |

## 证据规则

- 自动下载 E2E 使用 Runtime 实际读取的本地 HTTP 字节流，不用直接复制冒充下载；生产目录只在 hash 和自检后出现。
- bundled tiny 使用固定 revision 和四文件 SHA-256，权重不进入 Git；证据记录发布资产 manifest/hash/byte count。
- 真实推理必须输入由 ffmpeg 规范化为 16 kHz mono 的真实音频，输出至少一个带时间戳 segment；不把文本 fixture 当 ASR。
- 资源测量记录 CPU affinity、可见 GPU、RSS peak、wall time 和模型路径 hash；开发机物理资源较高不等于低资源通过。
- 公开证据不得包含绝对路径、用户目录、Cookie、音频正文或模型下载凭据。

## PRD 声明边界

本子阶段通过后最多声明：

```text
Navia supports explicit local ASR provider/model selection, bundled tiny fallback,
verified installation, offline recovery, and low-resource model self-test.
```

不得声明 V3-2 transcript、A06 quality、完整 B站视频理解或 V3 通过。

## 本地候选结果

本地 A01-A16 全部获得对应机器或真实数据证据：Runtime 模型管理测试 17/17；前端 ASR 设置测试 3/3；真实 Chrome 17/17；Tiny 低资源真实推理通过；Small 官方真实安装 ready 且重启保持。Chrome 安装弹窗使用 typed job transport 验证 UI 合同，实际公网下载/校验/自检/发布由独立 Runtime run 验证，两者不得伪称同一条端到端请求。最终判定仍等待不同 session 独立审查。

# V3-2-0b 低资源 ASR Provider 资格恢复验收计划

日期：2026-09-22。状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`。固定 `A01..A18`，不得 N/A。

| ID | 用户场景 / 操作 | 必须结果 |
|---|---|---|
| A01 | 校验 Schema、registry、fixtures、candidate manifest | Draft 2020-12 PASS；18 requirement 与 18 negative case 的 ID/key/failureCode 精确相等 |
| A02 | 下载官方 runtime/model/VAD | 平台、文件名、bytes、SHA-256、revision、license 全匹配；重定向只到冻结官方 host |
| A03 | 安装损坏/错误版本/未知资产 | 全部拒绝；不发布半成品；Tiny 保持 ready |
| A04 | 读取 Provider catalog | 仅 closed catalog；客户端不能提交 URL/hash/path/class/argv |
| A05 | 加载 native Provider | `remoteCode=false`、无 shell、无代理/token 继承；推理期间 0 网络 |
| A06 | 在 8 cores/8 GiB/no-GPU 启动 | 不 OOM；峰值 RSS、安装体积、耗时、RTF 全记录；GPU 不可见 |
| A07 | 转写 contract audio | 输出非空 timestamped segments；0 逆序/重叠/越界/重复 ID |
| A08 | 取消、timeout、child crash、Runtime restart | child、临时音频和 private work 全关闭；状态可恢复到 Tiny |
| A09 | 在 Settings 查看四个模型 | Tiny=`fallback_only`、Small=`failed_current_gate`、Paraformer=`qualification_pending/production_qualified`、Large=`high-resource excluded`；Linux/Windows 下载字节、512 MiB 安装上限、1 GiB 安装可用空间、8 GiB RSS 上限、0 VRAM 与 catalog 一致，实测前明确标为政策上限 |
| A10 | 点击 Paraformer 下载并安装 | 同一真实 Chrome run 观察 checking→downloading→verifying→self_testing→installing→ready；不是 intercept 假进度 |
| A11 | 自动下载失败后导入离线包 | 展示固定步骤；错误 package fail closed；正确 package 再次复算全部 hash |
| A12 | 用原三个真实 B站样本生成候选 | BVID/cid/P1 不变；每个固定 30s..150s；候选和 Small 使用同一音频 |
| A13 | 生成盲评页 | 3×8=24 bin；标签私有；页面无 Provider/model 名、无人工听写框 |
| A14 | reviewer A/B 独立操作并导出 | 两个不同 reviewerId；各 24/24；bundle hash 相同；缺项拒绝导出 |
| A15 | adjudicator 只记录和复核分歧 | Semantic validator 从两份不可变 review 重算两份 hash、48 个 reviewer+sample+bin 唯一键、24 个 sample+bin 键与全部 numerator；不得信任 summary 自报；分歧记录不改写原始 48 判断或质量分母 |
| A16 | 执行质量门禁 | candidate ≥44/48；每样本 ≥15/16；critical=0；neither=0；任一不满足即 FAIL |
| A17 | 四视口和无障碍 | 360/420/768/1280 无根溢出；Axe serious/critical=0；键盘、焦点、live progress、200% zoom 通过 |
| A18 | 清理、PRD 与独立审计 | Cookie/媒体/音频/private path 公开命中 0；Fatal=0/Major=0；只在此后允许关闭 A06 |

## False-green rejection

- 上游 CER、模型安装、自检、单个 reviewer、23/24 或总体平均都不能代替 A16。
- 旧失败 bundle/review 只能作 regression negative，不得拼接到新 run。
- contract fixture、原型文本、截屏和 UI interception 不计真实模型证据。
- 文档审查通过只允许请求实施授权；不允许声明 A06、V3-2 或 V3 PASS。

## Human feedback

人类只需逐 bin 听取原视频并比较两个机器文本，不做听写。每项选择更好/等价/均不可接受、两侧含义保留、错误分类和关键错误；第二名 reviewer 与 adjudicator 必须使用不同 ID。Adjudicator 只解释分歧，不能用一份 24 项 resolved list 覆盖或缩小两名 reviewer 的 48 项固定分母。

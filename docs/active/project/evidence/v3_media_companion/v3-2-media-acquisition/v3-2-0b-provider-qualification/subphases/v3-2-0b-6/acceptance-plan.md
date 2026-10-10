# V3-2-0b-6 双模型盲评材料验收计划

日期：2026-09-22。固定 `B06-01..B06-18`，无 N/A。

| ID | 操作 | 必须结果 |
|---|---|---|
| B06-01 | 绑定 0b-5 accepted run | runId 与 private handoff hash 精确匹配；无 invalidated 标记 |
| B06-02 | 复算三段 WAV | sample/BVID/cid/P1/window 与三个 SHA-256 精确匹配 |
| B06-03 | 复算候选输出 | 三 candidate SHA-256 与 handoff 精确匹配，segments 非空且有序 |
| B06-04 | 校验 Small 模型 | revision、四文件 size/hash、fileSetSha256 全匹配冻结 manifest |
| B06-05 | 运行基线 worker | 三样本均 exit 0；CPU/int8/beam1/VAD500/no-context；不下载模型 |
| B06-06 | 推理隔离 | 8 CPU、8 GiB、swap 0、AF_INET/AF_INET6 拒绝、PrivateDevices、GPU 不可见 |
| B06-07 | 基线结构 | 每样本非空 timestamped segments，0 逆序/重叠/越界 |
| B06-08 | 同源比较 | 两套输出只引用同一 WAV hash，不重新获取或跨 run 拼接 |
| B06-09 | 固定分母 | 3 样本 x 8 bins=24；每 bin 为相对 0..120s、绝对 30..150s 的 15 秒窗口 |
| B06-10 | 时间深链 | 24 个链接均为对应 BVID/P1 的绝对起点；可在 B站播放原声 |
| B06-11 | 盲化映射 | 每样本 A/B 映射唯一；只存在私有 0600 label map；公开材料 0 模型身份命中 |
| B06-12 | 页面任务边界 | 无 textarea/听写输入；逐 bin 仅比较 A/B、含义保留、错误类别和关键错误 |
| B06-13 | Review 导出 | reviewerId 合法、24 唯一 sample/bin、bundle hash 固定、无 transcript/label map |
| B06-14 | 双 reviewer 导入 | reviewerId 必须不同；两份各 24 项；缺项、重复、异 bundle fail closed |
| B06-15 | 裁决合同 | 只处理实质分歧；私有映射转换后满足资格 schema 的 48 判断统计字段 |
| B06-16 | 页面 E2E | 360/420/768/1280 四视口无横向溢出；Axe serious=0/critical=0；键盘主流程通过 |
| B06-17 | 独立验证与扫描 | verifier 全 PASS；公开材料无 Cookie、私有路径、label map、模型身份和音频/model binary |
| B06-18 | PRD/门禁 | 机器材料完成不等于质量通过；两个人类 reviewer 和裁决前 0b-6e/PQ/0b-7 均 pending |

机器出门要求：`B06-01..18` 中除需要真实人类判断内容的质量结论外，材料与机制 18/18 PASS，Fatal=0、Major=0，并明确 `humanReviewStatus=pending`。人类质量出门另要求两个不同 reviewerId、48 项判断、candidate meaning preserved >=44/48、每样本 >=15/16、critical=0、neither=0。

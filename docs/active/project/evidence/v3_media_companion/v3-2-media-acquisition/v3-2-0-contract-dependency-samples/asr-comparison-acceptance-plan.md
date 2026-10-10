# V3-2-0 双模型 ASR 比较材料验收计划

日期：2026-09-18。固定分母 `C01..C12`，无 N/A。

> 2026-09-21 状态：C01..C12 机器材料仍 PASS；用户最终人类结果触发 critical=1、neither-acceptable=1 和首样本 7/8，D08=`FAIL / REPLAN`。未来新 run 仍须执行本计划，不得复用当前失败 review。

| ID | 操作 | 必须结果 |
|---|---|---|
| C01 | Schema meta-validation | Draft 2020-12 PASS |
| C02 | 模型字节复算 | small/base revision、4 文件和 fileSet SHA-256 全匹配 |
| C03 | 真实媒体获取 | 3/3 目标 BVID、P1、cid 正确；源媒体只在私有 work dir |
| C04 | 固定窗口 | 每样本恰好 120 秒，30s..150s；不得动态挑窗 |
| C05 | 双模型离线推理 | 6/6 推理成功；相同 decode profile；0 云上传/联网换模型 |
| C06 | 固定分桶 | 3 x 8 = 24 bin；每 bin 15 秒；时间连续无重叠/空洞 |
| C07 | 盲评映射 | 三样本 A/B 交替；页面不显示模型身份；bundle 保留可审计映射 |
| C08 | 人工页面 | 无逐字输入框；每 bin 有原视频链接、A/B 文本、四选一、双含义判断、错误分类和可选短备注 |
| C09 | 双人独立导出 | reviewer ID、bundle hash、24 判断完整；缺项拒绝导出；结果不携带机器 transcript |
| C10 | 分歧复核 | 可导入两个不同 reviewer 的同 bundle 结果；只显示分歧；adjudicator 逐项关闭 |
| C11 | 隐私清理 | Cookie 原值 0 hit；cookiefile/source/audio/work 0 残留；公开材料无绝对私有路径 |
| C12 | UI/无障碍 | 360/420/768/1280 无根溢出；键盘主流程通过；Axe serious/critical=0；真实 Chrome 导出成功 |

比较材料 C01..C12 全通过，只允许把人类验收页交付 reviewer。两份独立 review 和 adjudication 未完成前，`D08=PENDING`、V3-2-1 仍 BLOCKED。

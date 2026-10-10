# V3-5-4 Ask、回跳与导出验收结果

日期：2026-10-09。决定：`V3-5-4 PASS / V3-5-5 MAY ENTER DETAILED PLANNING`。

## 1. 真实运行

- 成功 run：`v3-5-4-real-20261009T071402Z`。
- 固定真实页面：`https://www.bilibili.com/video/BV1ZpYd66ELP`。
- 原始 result SHA-256：`7fb730512f8068903a299f24cf955ee704d5b454b2c6290ecf6339295128400b`。
- 去敏结果：`v3-5-4-real-chrome-result.json`；31/31 检查通过。

## 2. 固定门槛

| 门槛 | 结果 | 真实证据 |
|---|---|---|
| 三类 Ask | PASS | 转写问题 2 引用、视觉问题 2 引用、无证据问题固定拒答且 0 引用 |
| 五入口回跳 | PASS | outline/timeline/mindmap/Ask citation/Evidence Drawer 独立点击；回读误差 0–100ms，均不超过 2s |
| 错页阻断 | PASS | 离开同一 B站视频后回跳 typed blocked，不误跳其他页面 |
| JSON 导出 | PASS | 7156 bytes，artifact SHA-256 独立匹配，知识导入状态 `deferred_to_v4` |
| Markdown ZIP | PASS | 3654 bytes；Python `zipfile` 可打开；6 个固定白名单成员与 manifest 精确相等 |
| 路由/恢复 | PASS | 8 个 canonical route、前进后退、legacy 替换、invalid route 回收、Side Panel 重开同 task |
| 隐私/清理 | PASS | 108 文件、4,024,994 bytes、0 secret hit；临时媒体/ASR=0；profile 与安全根删除 |

## 3. 作废运行

四个失败 run 均物理隔离且不参与通过结论：首轮关闭 Ask 阈值假阳性，次轮关闭历史 GET 覆盖 POST 的 UI 竞态，第三轮关闭 runner 复用旧结果节点的假阴性，第四轮关闭未声明 `unzip` 系统依赖。每项均先落盘修订审计，再以全新 run 重跑。

## 4. 清理

成功 run 的私有数据库、日志、媒体、音频、帧、导出实体及过程文件已在去敏摘录后删除。仓库仅保留哈希、计数、状态和本验收记录。

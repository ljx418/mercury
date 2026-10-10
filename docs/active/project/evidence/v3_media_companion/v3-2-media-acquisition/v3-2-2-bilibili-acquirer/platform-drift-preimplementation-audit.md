# V3-2-2 Amendment 1 实施前审计

日期：2026-10-06。决定：`CONDITIONAL GO FOR SINGLE-RUN REPROBE`。

## 审计结论

- Fatal：0。
- Major：0（旧 Cookie 无效 Major 已由 `code=0/isLogin=true` 关闭；样本漂移已显式重规划）。
- Minor：1（B站字幕事实仍可能再次变化，已由同一 run fail-closed 门禁承接）。

## 允许范围

允许执行 Amendment 1 合同测试、单一全新授权 Chrome 12 页 probe、Revision 3 候选生成与只读验证。禁止启动 V3-2-2 acquirer 产品实现、V3-2-3 ASR 或后续阶段，直到 Revision 3 候选通过独立审计。

## 审计检查

1. PRD 保留锚点但不再强制过时 ASR 路线。
2. 6+3+1+1+1 固定分母未缩小。
3. 三个 ASR 候选来自真实授权探测，当前分 P 约 223/1192/256 秒，并由 1200 秒上限机械约束低资源目标。
4. 字幕正例使用 API 字幕项；ASR 负条件拒绝平台新增字幕。
5. view/player response hash 读取真实 raw probe 字段并强制 SHA-256。
6. 多 P duration 必须绑定当前 cid/part，禁止把合集总时长写入当前 playback unit。
7. 生产证据禁止跨 run 拼接，人工验收仍推迟到 V3-5。

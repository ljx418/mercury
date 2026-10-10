# V3-1R 外审 Minor 关闭记录

日期：2026-09-17。对应外审：`independent-v3-1r-implementation-exit-audit.md` §9.1。

## 问题

外审将 manifest 的“平铺包 + 隔离解包内容”合计理解为 archive 单独统计，因而报告 20 文件和 7,568,210 bytes 的差值。

## 独立复算与修订

- 19 个受 SHA-256 保护的载荷，不含 manifest：19 文件，7,564,687 bytes。
- `19-public-evidence.tar.gz` 单独隔离解包：110 文件，9,857,625 bytes。
- 两集合相加：129 文件，17,422,312 bytes。
- manifest 是第 20 个平铺文件，但不参与自身 payload hash/bytes 合计，避免自引用。

manifest 已改为分别写出三组数字，不再使用可被误读的单句合计。

collector 的 107 文件计数发生在写入 `secret-scan.json` 与 `acceptance-verification.json` 之前；verifier 的 108 文件计数发生在已有 `secret-scan.json`、尚未重写 `acceptance-verification.json` 时；archive 的 110 文件还包含最终机器结果及注册表。三者是不同扫描时点，不是固定 archive 分母。

## 结论

文档口径 Minor 已关闭；19 个 payload hash、archive bytes、build/registry/result 绑定均未改变。不需要重采真实 Chrome，也不改变外审 Fatal=0/Major=0 的决定。

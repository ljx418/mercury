# V3-2-0b-0 供应链冻结验收计划

日期：2026-09-22。固定 `B00-01..B00-12`，不得 N/A。

| ID | 操作 | 必须结果 |
|---|---|---|
| B00-01 | 解析 candidate manifest | 恰有 2 runtime + 2 model 资产；关键字段闭集且无重复逻辑身份 |
| B00-02 | 下载 Linux runtime | 最终 bytes=`8014474`、SHA-256=`779967de...f35e52` |
| B00-03 | 下载 Windows runtime | 最终 bytes=`4967457`、SHA-256=`f6a73a54...492e` |
| B00-04 | 下载 Paraformer Q8 | 最终 bytes=`236929024`、SHA-256=`42bf76ea...ee011` |
| B00-05 | 下载 FSMN-VAD | 最终 bytes=`1720512`、SHA-256=`1270f255...f5479` |
| B00-06 | 检查来源与重定向 | 初始与最终 host 均在冻结官方 allowlist，无凭据、无明文 HTTP |
| B00-07 | 枚举两个 runtime 归档 | 0 绝对路径、0 `..`、0 设备/FIFO、0 越界链接；成员和展开字节已记录 |
| B00-08 | 对账 release/revision | runtime tag 和两个模型 commit 与 manifest 精确一致 |
| B00-09 | 对账许可 | toolkit=MIT、两个 GGUF=Apache-2.0；许可来源和 hash 可复算 |
| B00-10 | 生成 dependency manifest | 四个资产状态均 `verified`，不含本地绝对路径和二进制内容 |
| B00-11 | 做秘密与仓库边界扫描 | evidence 中 Cookie/token/Authorization/宿主绝对路径命中 0；资产目录保持 gitignored |
| B00-12 | PRD/门禁复核 | 只关闭 A02 的供应链前置；A03..A18 和 V3-2-A06 仍未通过，0b-1 未自动获准 |

## 防假绿

- HTTP 200、文件可解压、上游网页显示版本号均不能替代 byte/hash 对账。
- 已知哈希文本不能替代实际下载文件复算。
- Linux 成功不能代替 Windows 清单完整，反之亦然。
- 许可名称字符串不能替代官方许可文件/元数据复核。
- 本阶段 PASS 不能升级 candidate 的 `quality.status`。

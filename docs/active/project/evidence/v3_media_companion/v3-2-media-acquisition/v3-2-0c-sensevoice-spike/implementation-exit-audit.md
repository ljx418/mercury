# V3-2-0c 最小 Spike 内部实施出门审计

日期：2026-09-22  
决定：`LIMITED PASS FOR PRODUCTION-CANDIDATE DOCUMENTATION ONLY`

## 审计

- 固定资产：3/3 identity PASS；模型下载完整 bytes/SHA PASS。
- 固定样本：3/3 tuple 与 source/payload hash PASS；目标遗漏未被替换。
- 真实推理：3/3 exit 0、非空、SRT 合法；逐项 wall/RSS 已记录。
- 网络：推理进程 seccomp deny-list 生效，socket 自测 fail closed。
- 清理：无残留推理进程；临时 WAV/SRT/stderr 删除；source 未改。
- 隐私：公开结果仅 hash/count/resource；扫描 0 命中。
- 状态：结果明确 `productionQualified=false`；catalog/UI/API 未修改。

Fatal=0，Major=0，Minor=3：Linux 单平台；仅 3 个 15 秒窗口；三窗均为近整窗单 segment，时间粒度尚未证明。三项均阻止生产资格，不阻断下一轮文档工作。

允许：进入路线 C 生产候选详细文档、合同、威胁建模与外部文档审查。  
禁止：将 SenseVoice 标为可选择/qualified、修改 Tiny effective、进入 V3-2-1、声明 V3-2/V3 完成。

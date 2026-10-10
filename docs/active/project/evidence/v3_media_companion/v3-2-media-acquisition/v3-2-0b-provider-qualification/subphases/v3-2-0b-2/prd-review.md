# V3-2-0b-2 PRD 规格检视

日期：2026-09-22

- 资源披露与冻结资产一致：Linux 下载 246,664,010 bytes、安装 241,074,376 bytes、1 GiB free、8 GiB RAM ceiling、0 VRAM。
- 安装 ready 与质量 production qualified 完全分离；pending 不可选择、不替换 Tiny。
- source archive 只提取冻结 executable，未发布下载脚本/README/其他工具，供应链面未扩大。
- 旧 Tiny/Small、API 注入拒绝、取消/重启/卸载均回归通过。
- 未进入 UI、样本推理或人工质量判断；V3-2-A06 仍 FAIL/REPLAN。

规格新增=0、删减=0、门槛降低=0。允许进入 `0b-3` 计划与审计。

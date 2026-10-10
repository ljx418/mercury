# V3-2-0b-0 供应链冻结开发计划

日期：2026-09-22  
状态：`AUTHORIZED / PREIMPLEMENTATION AUDIT REQUIRED`

## 目标

从候选 manifest 指定的官方地址独立下载 Linux/Windows runtime、Paraformer Q8 和 FSMN-VAD 四个资产，并冻结一份不含二进制与宿主绝对路径的 dependency/build evidence。该阶段不接入产品 catalog，不执行推理，不改变质量状态。

## 输入

- `contracts/v3-asr-provider-qualification-candidate-manifest.json`
- GitHub `modelscope/FunASR` release `runtime-llamacpp-v0.2.6`
- Hugging Face 固定 commit 下的两个 GGUF 文件
- FunASR MIT 与两个模型 Apache-2.0 许可声明

## 实施步骤

1. 创建 gitignored 的 `.tmp/v3-asr-provider-qualification/assets` 私有工作目录，权限收紧为当前用户可读写。
2. 对每个 URL 禁止凭据，限制初始 host 与重定向 host；记录重定向后的 host，不记录 query secret。
3. 流式下载并同时计算 byte length 和 SHA-256；与 candidate manifest 逐项比较。
4. 对 tar/zip 只读枚举，拒绝绝对路径、`..`、设备文件、FIFO、越界 symlink/hardlink 和异常膨胀。
5. 读取官方归档帮助/README 与模型仓许可元数据；许可不一致或缺失即停止。
6. 生成 `asset-verification.json`、`archive-inventory.json`、`license-verification.json` 与 `dependency-manifest.json`；只保留相对逻辑名、公开 URL、bytes/hash/license，不保留本地绝对路径。
7. 对证据执行秘密扫描和 JSON Schema/字段闭集检查；二进制留在 `.tmp`，不得进入 evidence 或 git。

## 交付

- `implementation/verify_qualification_assets.py`
- `runs/<runId>/asset-verification.json`
- `runs/<runId>/archive-inventory.json`
- `runs/<runId>/license-verification.json`
- `runs/<runId>/dependency-manifest.json`
- `acceptance-result.md`
- `prd-review.md`

## 停止条件

任一资产 URL、byte length、SHA-256、revision 或 license 漂移；重定向离开冻结官方 host；归档路径不安全；下载依赖 remote code；公开证据含 token/cookie/本地绝对路径；或无法为 Windows/Linux 两个平台形成可复算清单。

## 非目标

不安装、不运行 native binary，不把 Paraformer 标为 installable/selectable/qualified，不生成转写，不修改前端，不进入 V3-2-0b-1。

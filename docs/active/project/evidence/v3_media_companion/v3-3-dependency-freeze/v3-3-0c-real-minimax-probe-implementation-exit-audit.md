# V3-3-0c 真实 MiniMax 能力探针实施出门审计

日期：2026-10-08。

## 结论

`V3-3-0c REAL MINIMAX CAPABILITY PASS`。Fatal=0，Major=0，Minor=1。

## 真实结果

- 相同 `sk-cp-` 凭据：中国区模型列表 HTTP 200、套餐状态 `status_code=0`；国际区 HTTP 401/2049。
- 设置页真实操作：选择 `MiniMax Vision（中国区）`、模型 `MiniMax-M3`，点击“保存、测试并使用”。
- 真实中性图结果：PASS；页面观测为 315 tokens、1884 ms，并显示“当前使用”。
- Runtime 停止后由仓库根目录 `Navia Runtime.lnk` 重新启动；设置页仍显示中国区为当前项，密钥保存在 Windows 凭据库。
- 后端 17 tests、前端 7 tests、TypeScript typecheck、WXT production build 全部通过。
- 对相关源码与 3.77 MB 构建树执行授权 Key 精确扫描，0 hit。

## 修复

1. 新增中国区封闭 Provider `minimax-cn-openai-vision`，国际区 ID 保持兼容。
2. 401/403 映射为 `VISION_CREDENTIAL_REGION_MISMATCH`。
3. 中性探针关闭思考、温度 0.1、摘要上限 120 字符，避免长推理导致结构假失败。
4. 新增 selected-provider 脱敏 probe，输出不含 secret、响应私有 ID 或用户内容。

## Minor

M-1：本审计与实现由同一自动化 session 完成，组织独立性留给 V3-3-7；不影响真实端点、UI 和重启证据。

## 门禁

允许进入 V3-3-1 媒体绑定与抽帧实施。禁止把本 PASS 扩大为 8/10 真实帧 VLM、V3-3 或 V3 整体 PASS。

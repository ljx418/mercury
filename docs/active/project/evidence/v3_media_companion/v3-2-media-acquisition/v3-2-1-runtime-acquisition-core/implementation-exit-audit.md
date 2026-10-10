# V3-2-1 实施出门内部审计

日期：2026-09-22  
决定：`V3-2-1 LIMITED PASS`  
严重度：Fatal=0 / Major=0 / Minor=2

## 1. 代码与测试

- 新增 `acquisition/task_artifacts.py`：owner manifest、随机 task sandbox、原子私有文件、配额、跨 task 防护、清理和 orphan recovery。
- 新增 `acquisition/coordinator.py`：B站 registry-bound task create/get/cancel、身份一致性、幂等和 cleanup barrier。
- Runtime 新增 `POST/GET/DELETE /v1/media/acquisitions`，响应 no-store，request closed set。
- 媒体机器合同迁移到 SenseVoice profile并实跑 49/49。
- 测试：定向 14 passed；Runtime 全量 346 passed；前一子阶段前端全量 293 passed/typecheck/build exit 0（本阶段无前端代码变更）。

## 2. 真实证据与隐私

正式 run 使用私有真实 B站 WAV 的全部 `3840078` 字节。写入后的 size/hash 与源一致，取消后 task directory 删除；另建 orphan 后重启恢复 1 个，未知目录保留。公开 result 仅含 artifact ID、bytes/hash/mode 和状态，不含音频、转写、Cookie 或私有路径。

## 3. Minor

- M-1：实施与审计在同一 session，仍需外部只读复审才能升级为独立 PASS。
- M-2：任务事实当前只在进程内；重启只保证私有 orphan cleanup，不保证任务恢复。该行为符合 V3-2-1 范围，后续若要求 durable task 必须另立合同，不能静默加入。

## 4. 门禁

- V3-2-1 Runtime core：`LIMITED PASS`。
- V3-2-2 implementation：`NO-GO`，原因不是代码失败，而是 sample registry 的旧质量前置与 V4 延期决策冲突。
- 下一允许动作：只允许 V3-2 sample registry revision 3 文档冻结、内部/外部审查和 V3-2-2 详细计划。
- V3-2/V3 整体：未通过。


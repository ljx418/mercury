# V3 全部剩余开发计划

本计划是总顺序，不代表后续所有阶段已经取得代码实施授权。已完备支撑且已授权的子阶段可以实施；尚未冻结的阶段先完成“体验对齐 -> 详细计划/验收 -> 内审 -> 独立外审 -> 明确授权”。不得因“直到 V3 完成”的总目标跳过阶段门禁。

## Phase 0：恢复审计与 runner 收敛

1. 独立审查两个 B-5-3 runner 的 fresh isolation、进程清理、超时、secret scan、禁止上传计数和退出码。
2. 修复 BVID 1 Stage A 7 分钟超时的真实原因；不得直接放宽超时掩盖卡死。
3. 为 runner 增加本地单元/契约测试，覆盖成功、单 blocked、两个 blocked、SIGTERM、Runtime 异常、Chrome worker 缺失和清理失败。
4. 关闭 Fatal/Major 后才能重启真实六视频 run。

## Phase 1：B-5-3 真实六视频 fresh run

1. 新建唯一 run ID，六个 BVID 各自使用 fresh Runtime/database/profile/task。
2. 强制 `--mute-audio`；验证 extension worker、Runtime origin、任务收敛和 evidence catalog。
3. 每个 BVID 只锁定一个 Provider；不跨 Provider 拼接、不进行最佳 N 选一、不隐式 fallback。
4. 保存 receipt、派生文本哈希、质量门槛、blocked 原因、secret/raw-media scan 和 cleanup。
5. 六视频全部结束后生成不可变 summary；累计两个 blocked 直接 NO-GO。

## Phase 2：B-5-4..B-5-7

1. B-5-4：验证并清理 Chrome、Runtime、profile、临时媒体、ASR cache 和任务目录。
2. B-5-5：生成 closure package；不得包含秘密、原始媒体或本地路径。
3. B-5-6：落盘实现 handoff、PRD 覆盖、合同变更、测试、真实数据证据和剩余风险。
4. B-5-7：重建平铺 external audit package（总文件数 <=20），逐文件 SHA-256，提交独立实施出门审查。

## Phase 3：B-6 / B-7

1. B-6：宿主 LLM 对六视频输出进行独立语义质量审核，检查错误、无关、缺乏概括性、证据错配和章节失衡。
2. B-7：人类内容质量验收；在完成前 Stage B 不能 PASS。

## Phase 4：Stage C/D/E 与 Chat/Know

1. Stage C：任务状态披露、计时器、卡片堆叠、完成态同步、错误展开、取消/重启恢复和长时间无进展处理。
2. Stage D：100 字内 brief、合理章节、层级大纲、截图证据、视频反跳、秒数时间线、可拖拽概念关系图和至少五种可配置导出风格；大纲/时间线/导图必须表达不同信息结构。
3. V3-4.1 / Chat + Know：复用当前页与媒体事实，实现 `ContextEnvelope -> KnowledgeDraft -> KnowledgeItem` 的预览、编辑、取消、显式保存，以及 Know 真实列表/详情/标签/自定义字段/排序/归档/普通删除/来源反跳；禁止 Mock 成功和未确认写库。
4. Stage E：六视频真实端到端交互验收，加普通网页与知识闭环；覆盖四视口、键盘/Axe、性能、恢复、清理、Side Panel/Workspace 同任务和 Chat/Know 一级信息架构。

## Phase 5：V3-6 / V3-7 与阶段收口

1. V3-6：以同一 production candidate build 执行原 12 页 B站单 run、真实 OCR/VLM/ASR/截图证据、故障/隐私/资源/清理矩阵；追加普通网页、Runtime 手动生命周期、KnowledgeDraft/KnowledgeItem 事务、Chat/Know 和至少五种导出风格，不能替换原分母。
2. V3-7：只读复算原 H01..H10、V3-5.1 内容质量、V3-6 单 run、CX-H01..CX-H06 与 Chat/Know 分母；Fatal=0/Major=0 才可进入最终人工体验。
3. 阶段收口：把目标架构/Draw.io 状态同步到实际代码，生成中文 HTML 可视化验收报告，完成最小人工体验路径和真实签署；未签署项保持 pending。
4. 独立审计允许后，按范围整理 Git 提交并执行项目进展同步；不得为得到干净工作树而删除既有用户差异。

## 明确延期边界

- V4：跨来源 Query、Graph、Durable Forget、自动老化、长期记忆维护与高级模型回退优化。
- V5+：Agent 一级模块、多 Agent、长短时任务和基于知识库的复杂文档生成。
- 以上能力不得计入 V3 PASS，也不得因未实现而阻止 V3 已冻结范围出门。

每个 Phase 必须遵循：详细计划 -> 验收标准 -> 实施前审计 -> 实现 -> 自动化/真实数据验收 -> PRD 检视 -> 独立出门审查。Fatal/Major 不为 0 时不得进入下一阶段。

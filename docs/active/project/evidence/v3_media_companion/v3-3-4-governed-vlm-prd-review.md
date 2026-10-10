# V3-3-4 PRD 规格检视

日期：2026-10-08。结论：`PASS WITH STAGE BOUNDARY`。

- 真实云调用仅处理用户已授权的当前任务选定帧；没有上传原视频、连续帧或网页上下文。
- 授权状态持久化且每次 dispatch 重检；撤销先写 barrier，之后新请求为 0。
- 任务全生命周期最多 8 次外发，UI/Provider 无扩大预算入口。
- Provider/model 固定为已验证当前选择，不因 529 或其他故障静默切换。
- VLM caption 保持独立 `vision_caption` 类型，不替代 OCR、transcript 或最终大纲事实。
- 本阶段没有提前实现 V3-4 outline、V3-5 UI/H 项、YouTube/小红书或 V4 知识写入。


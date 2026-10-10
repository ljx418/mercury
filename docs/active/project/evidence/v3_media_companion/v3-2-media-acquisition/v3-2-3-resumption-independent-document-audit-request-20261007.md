# V3-2-3 实施前恢复独立文档审查请求

日期：2026-10-07。审查对象：Route B3 LIMITED PASS 后修订的 SenseVoice 全长转写实施前文档候选。

## 1. 必须回答

1. 19 项载荷 SHA-256 是否全部匹配 manifest，权威源与平铺副本是否 0 mismatch？
2. B3 source run/content SHA 与独立 `LIMITED PASS` 是否绑定准确，是否错误复用已清理音频或旧 run？
3. 三个固定能力槽位、BVID、顺序、预绑定 fault 与动态触发和=3 是否和 PRD/Route B3 一致？
4. acceptance wrapper 是否保持真实字幕发现先行、单槽最多一次预绑定 fault，并且产品 Runtime/API/env/Acquirer/registry 0 可达？
5. acquisition sandbox -> 私有流式 copy -> native ASR root -> 双层 cleanup 是否可由现有代码边界实现，是否存在 path/link/cross-task/残留风险？
6. SenseVoice engine/version/model/revision/weights/VAD/CPU/Q8/development_baseline 是否精确一致，是否偷偷引入 Tiny、云端或自动回退？
7. VAD start/end count + SRT count equality 是否真实消除 coverage 循环证明；成功 1.0、mismatch fail closed 是否比 PRD >=90% 更严格而非缩分母？
8. `2-3-0..7`、ST01..ST20、failure code、timeout、低资源、秘密、资源、seal 和独立审计是否完整且无 N/A？
9. 是否仍把 24-bin 双 reviewer/V4 质量优化误作 V3 门槛，或反向把 `development_baseline` 扩大为 production-qualified？
10. 人工听写/H01..H10 是否仍只在 V3-5，V3-2-3 是否保持自动真实数据验收？

## 2. 复算要求

- 独立重算 19 项载荷 hash，并与仓库权威源逐字节对账。
- 对 Transcript Execution v2 执行 Draft 2020-12 meta/positive validation；复算 strict coverage fixture。
- 静态复核 `provider.py`、`funasr_llamacpp.py`、`native_process.py`，确认计划新增点和既有安全边界相容。
- 只读审查，不运行 Chrome、Runtime、yt-dlp、ffmpeg、SenseVoice、产品 pytest 或旧 PX 工具。
- 不修改现有文件；只允许写一份报告：
  `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-resumption-independent-document-audit-20261007.md`。

## 3. 二元门禁

- `DOCUMENT CONDITIONAL GO`：仅当 Fatal=0/Major=0；只允许进入 V3-2-3 实现，不放行 V3-2-4/V3-2/V3。
- `FAIL/REPLAN`：任何 Fatal/Major 非零；必须返回文档阶段闭环。

Minor 必须逐项给出后继处置，不得通过降低真实数据、固定分母、秘密、cleanup、资源或独立审计门槛关闭。

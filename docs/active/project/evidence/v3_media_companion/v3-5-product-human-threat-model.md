# V3-5 产品 UI、Ask、反跳、导出与人类签署威胁模型

日期：2026-10-08。状态：`DOCUMENT RESUMPTION CANDIDATE`。

| ID | 威胁 | 控制 |
|---|---|---|
| UI01 | 前端缓存伪造恢复 | route loader 始终读取 Runtime task/revision |
| UI02 | Side Panel/Workspace 指向不同 task | deep link + server identity binding |
| UI03 | Ask 无证据幻觉 | answered min evidence；视觉问题要求视觉 evidence；validator |
| UI04 | 引用跨 task | task/evidence catalog closure |
| UI05 | seek 到错误视频/分P或越过当前分P时长 | current page identity + playbackUnit check + currentTime readback + `TaskBinding.mediaDurationMs` + Schema `deltaMs<=2000/located identity=true` + 语义校验器复算时长边界 |
| UI06 | fallback 冒充 located | closed outcome 与 <=2s 条件 |
| UI07 | Markdown/HTML 注入 | plain text/allowlisted markdown、URL/HTML sanitize |
| UI08 | 导出泄露秘密/私有路径 | member allowlist、relative refs、secret/path scan |
| UI09 | 导出 zip slip | normalized member names、no absolute/`..`、extract test |
| UI10 | 任务历史泄露跨 workspace 内容 | local authenticated Runtime、task scope、no telemetry |
| UI11 | 人类签署被自动代填 | submission schema、reviewer input、bundle hash、automation deny |
| UI12 | 用旧截图验收新 build | screenshot build/run binding and freshness check |
| UI13 | 人工被要求补机器证据或总判定伪绿 | H 项只判断可见体验；自动门槛先行；Schema 强制 PASS/FAIL/BLOCKED 与逐项判断一致 |
| UI14 | 取消后 UI 仍显示成功 | terminal receipt + cleanup barrier before success render |
| UI15 | V3 导出冒充知识库 | const deferred 状态和明确文案 |
| UI16 | registry 字幕分类冒充本次实际字幕 route | UI 只消费 Runtime route/event；ASR 回退显式显示资源/时延/取消；A03 对账 sealed execution |
| UI17 | 新 media router 破坏既有 Knowledge router | path prefix 先分派；`#/knowledge/*` 回归；旧 transcript path 仅 replace 迁移 |
| UI18 | v1 product receipt 缺少执行路线仍被 fresh run 接受 | v1 只读归档；fresh run 只接受 product acceptance v2；缺 `taskExecution` 直接失败 |
| UI19 | ASR 资源提示只写文案、未与真实执行绑定 | v2 receipt 绑定 observed route 与资源数值；Schema + semantic verifier 双重拒绝假绿 |

当前 V3-4 已 LIMITED PASS；product acceptance v2 与 H submission schema 已落盘，但本轮 route drift、资源合同与兼容路由修订尚待外部复审，因此 implementation/Human Review 均 NO-GO。

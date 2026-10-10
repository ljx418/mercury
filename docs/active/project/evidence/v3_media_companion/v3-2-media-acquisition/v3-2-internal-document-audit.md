# V3-2 受控媒体获取文档候选内部风险闭环审计

日期：2026-09-17。审计性质：文档、机器合同和 Draw.io 静态审计；未进入 V3-2 产品代码、依赖安装、真实媒体获取、ASR 或 tabCapture 执行。

## 0. 决定

```text
V3-1.3 Browser-to-Runtime credential transport: PASS（保持）
V3-2 document candidate: READY FOR EXTERNAL DOCUMENT AUDIT
V3-2 implementation: NO-GO
Fatal: 0
Major: 0
Minor / deferred implementation prerequisites: 3
```

当前文档已足以让后续 Agent 从 V3-2-0 开始顺序开发，但只有外部独立文档审查 Fatal=0/Major=0 且用户明确批准 `V3-2-0..7 implementation` 后才可进入代码或依赖安装。

## 1. 审计输入

- 产品权威：`01-prd.md` §18.4。
- 架构权威：`02-architecture.md` §22.7。
- 阶段门禁：`stage-gates/v3-media-companion.md` §12。
- 合同规格：`v3-2-contract-and-api-spec.md`。
- 开发与验收：`v3-2-development-plan.md`、`v3-2-acceptance-plan.md`。
- 威胁模型：`v3-2-threat-model.md`。
- Policy：`contracts/v3-media-acquisition-policy-registry.json`。
- Schema：`contracts/v3_media_acquisition_contracts.schema.json`、`contracts/v3_media_acquisition_sample_registry.schema.json`。
- Positive / fixtures：`fixtures/v3-media-acquisition-contract-positive.json`、`fixtures/v3-media-acquisition-contract-fixtures.json`。
- 图纸：`design/v3-media-companion-gap.drawio`。
- 上阶段独立结论：`v3-1.3-independent-implementation-exit-audit.md`。

## 2. PRD 与范围检视

V3-2 只交付 `MediaTranscript`，不提前交付关键帧、OCR、VLM、`VideoOutline`、Mindmap、Ask、持久历史、导出或 V4 知识。用户路径为：

```text
当前 B站视频 + V3-1.3 同 task lease
-> 凭据字幕
-> 凭据媒体 + 本地 ASR
-> 公开/页内字幕
-> 可见 UI 新鲜点击 + 当前 tab capture + 本地 ASR
-> transcript
-> 五终态 cleanup barrier
```

主路径、双容器职责、失败文案、取消、清理和真实样本分母均没有扩大或缩小 PRD。YouTube、小红书只保留开放接口规则，未加入本轮实现分母。

## 3. 本轮发现与修复

| ID | 原问题 | 级别 | 修复 | 状态 |
|---|---|---:|---|---|
| IR-01 | README、开发计划和 gap 仍把 V3-1.3 写成外审 pending / channel 待新增 | Major | 统一为 V3-1.3 PASS；V3-2 仅文档候选 | CLOSED |
| IR-02 | 原 32 cases 未直接证明 transcript/hash、capture authority、attempt time 和 cleanup binding | Major | 扩展为 48 requirements/cases：12 Schema + 36 semantic | CLOSED |
| IR-03 | transcript content hash 篡改同时触发 provenance 与 ASR binding，FailureCode 优先级不明确 | Major | 冻结为先复算 transcript，再核对 ASR output binding | CLOSED |
| IR-04 | revision 1 样本缺目标分 P、预期路线、Chrome 版本、依赖/model binding 和 gold window | Major | 新增 production-only revision 2 sample registry Schema；禁止 pending/template 冒充 | CLOSED |
| IR-05 | Offscreen/stream ID 的最低 Chrome 版本和用户原声回放未定义 | Major | 冻结 Chrome 116+、`USER_MEDIA`、单实例、立即消费、AudioContext 原声回放 | CLOSED |
| IR-06 | Draw.io 仍只显示抽象 acquisition 与旧 A01-A14 | Minor | 显示 V3-2 文档候选、四路线、30 秒 grant、五终态清理和 A01-A20 | CLOSED |

## 4. 机器合同复算

独立内存校验结果：

```text
Acquisition Schema Draft 2020-12 meta: PASS
Sample Registry Schema Draft 2020-12 meta: PASS
Positive Schema errors: 0
Positive semantic failure: null
Requirements: 48 unique
Cases: 48 unique
Schema negative cases: 12/12 declared result
Semantic negative cases: 36/36 declared FailureCode
Requirement/case mapping: exact match
Policy/Schema FailureCode set: exact match
Positive segment text hashes: PASS
Positive contentSha256:
  6b6beafbb5001113de5dac6c0ac0157f977da4451bdea5e081268ddd9685665a
```

每个 semantic case 只修改一个 JSON Pointer，并保持 Schema-valid。Positive base 在任何 mutation 前通过全部当前 semantic 规则。

## 5. 固定语义和假绿防线

- route 必须是 policy 前缀，attempt 连续且时间不重叠，首成功后停止。
- credential route 必须绑定 task lease；capture route 必须绑定同 task/adapter 的 30 秒 one-shot grant。
- capture 的 stream ID 不能用 grant TTL 替代浏览器自身短时效；失败必须新点击。
- ASR 必须 local/no-cloud，profile/model/input/output/hash 全绑定。
- transcript segment/text/content hash 可复算，acquisition/asr/transcript 三方绑定。
- 五种终态都要先完成 cleanup；任何残留不能成功。
- 12 页、3 个完整 ASR、3 个双人 120 秒 gold window、至少 1 个真实 capture 都必须来自单一新 production run。
- fixture WAV、Mock、BiliNote 输出、旧 run 或跨 run 拼接均不能计生产分母。

## 6. Chrome 可实现性核查

官方 Chrome Extension 文档支持当前设计：

- `tabCapture` 只能在用户调用扩展后开始；Chrome 116 起，Service Worker 取得的 stream ID 可由同 extension origin 的 Offscreen Document 消费。
- stream ID 一次性且会在短时间后失效。
- Offscreen API 需要 manifest `offscreen` 权限；文档必须是扩展内静态 HTML；创建时提供 reason 和 justification；Offscreen 只直接支持 `chrome.runtime` 扩展 API。
- 普通 profile 同时最多一个 Offscreen Document。
- capture tab 音频后默认播放路径会变化，需用 AudioContext 接回输出，避免用户听不到原视频。

来源：

- `https://developer.chrome.com/docs/extensions/reference/api/tabCapture`
- `https://developer.chrome.com/docs/extensions/reference/api/offscreen`

## 7. 依赖和 BiliNote 边界

本机只读探测：

```text
ffmpeg/ffprobe: available, ffmpeg 6.1.1-3ubuntu5
faster-whisper: available, 1.2.1
yt-dlp CLI/module: unavailable
```

因此 V3-2-0 dependency spike 是真实硬门槛，而不是文档装饰。禁止在未冻结 yt-dlp executable hash/license/config isolation、ffmpeg capabilities 和 model weights hash 前写 acquisition 产品代码。

BiliNote HEAD 与 allowlist 绑定 clean commit 均为 `be3889395afb5346aa4339ae933d3ba2e08f25a8`；六个 allowlist 文件和 LICENSE 的 hash/byteLength 全部匹配。其本地工作树仍有三个 dirty 文件，但都不在 allowlist，且 policy 仍为 `reference_only`、copy 未授权。

## 8. Draw.io 结构审计

```text
pages: 8
vertices: 113
edges: 54
duplicate IDs: 0
missing source/target refs: 0
out-of-bounds nodes against 1600x900: 0
```

八页分别覆盖目标体验、代码实体、双容器、Cookie/媒体/双回退、任务/证据、BiliNote 治理、开发/自动验收、人类出门。V3-2 状态均标为文档候选或未开发，不存在“媒体/ASR 已实现”误标。

## 9. 三项非阻断剩余项

### M-1 Revision 2 尚无真实实例

当前只有 revision 1 历史页面探测。Revision 2 必须在获批后的 V3-2-0 用用户授权 Chrome 116+ 重新生成。没有通过新 Schema、唯一性/分类 semantic gate 和 artifact hash 的实例时，V3-2-1 必须停止。

### M-2 依赖与模型尚未冻结

审计当时 yt-dlp 不可用，ffmpeg executable/capability manifest 与 faster-whisper model revision/weights hash 尚未冻结。该历史前置事实已由后续 V3-2-0 `dependency-manifest.json`、`model-manifest.json` 和真实探针关闭；当前 Runtime core 的阻断已变为 revision 2 双人 gold window，不得继续引用本段作为现状。

### M-3 Draw.io 桌面视觉签署待外部审查

XML 结构通过，但本轮未用桌面 Draw.io 执行人工视觉签署。外审应检查第 4、7、8 页是否能快速区分 V3-1.3 已实现、V3-2 文档候选和 V3-3+ 未开发。

## 10. 外部审查请求

外部审查必须回答：

1. 四 route、lease/grant、Chrome 116 Offscreen 和 cleanup 是否可实现且无越权路径？
2. 48 个 case 是否覆盖关键语义且不存在 base false-green？
3. Revision 2 Schema、12 页分母和 ASR gold/质量门槛是否足够拒绝换样与伪转写？
4. V3-2-0..7 是否线性无环，且每一阶段都有失败停止条件？
5. 是否存在把 V3-1.3 PASS 扩大为媒体获取完成，或把 V3-2 transcript 扩大为视频理解完成的声明？

通过条件：Fatal=0、Major=0。通过仍只表示可以向用户请求 V3-2 实施授权，不自动授权代码。

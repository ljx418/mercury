# V3-2-3 模块交接

日期：2026-10-07。状态：`IMPLEMENTATION EXIT CANDIDATE`。

## Changed files

- Runtime：`app.py` 的 transcript create/get/cancel API。
- Acquisition：`contracts.py`、`audio_ref.py`、`transcript_lineage.py`、`transcript_service.py`、`transcript_validator.py`。
- ASR：provider raw receipt、FunASR SenseVoice VAD 解析、native host 资源/网络/诊断/close。
- Tooling：V3-2-3 runner、verifier、sealer。
- Tests：provider 与 SenseVoice transcript 定向覆盖。
- Docs：Stage Gate、总验收与设计计划同步 Revision 5。

## Contract changes

新增内部 `AcquisitionAudioRef`、VAD count/peak RSS raw receipt 和 Runtime transcript closed-body endpoint；没有修改 V1.2 A/B/C/D 公共合同。公开 API 不接受路径、Cookie、provider class、模型目录或 stderr。

## Tests and real evidence

- SenseVoice/provider focused：41 passed。
- Runtime full：474 passed。
- Frontend full：293 passed；typecheck/build exit 0。
- Credential：25/25 + 9/9 + 2/2。
- 真实 run：`v3-2-3-sensevoice-20261007T044217Z`，3/3 full transcript，ST01..ST20 20/20。

## PRD coverage and remaining risks

已覆盖真实媒体到本地 timestamp transcript、progress、cancel、failure、privacy、cleanup 和低资源边界。未覆盖 tabCapture、OCR/VLM、outline/timeline/mindmap/Ask/export；这些仍由 V3-2-4 及后续阶段承担。下一步只能先做外部实施出门审查。

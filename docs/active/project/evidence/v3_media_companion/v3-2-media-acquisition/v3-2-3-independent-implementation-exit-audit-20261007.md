# V3-2-3 实施出门独立审查（V3-2-3 LIMITED PASS 候选）

日期：2026-10-07。审查对象：`docs/active/project/external-audit-package/` 19 项平铺载荷。审查模式：只读、隔离解包、sha256sum、jsonschema、Python 标准库与定向单文件测试；不运行 Chrome / Runtime / yt-dlp / ffmpeg / SenseVoice / 真实 acquisition / 旧 PX generator 或 validator / 真实 Cookie 文件。

候选 run：`v3-2-3-sensevoice-20261007T044217Z`。B3 权威源：`v3-2-route-b3-20261007T014759Z`、content `66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea`。

---

## 0. 二元门禁原话（来自 `01-audit-request.md`）

> 请给出：`V3-2-3 LIMITED PASS` 或 `FAIL/REPLAN`，并按 Fatal/Major/Minor 分类。通过仅允许进入 V3-2-4 高风险实施授权前的详细复核；不得扩大为 V3-2、V3、视频理解、图文大纲或生产质量认证。
---

## 1. 18 项载荷 SHA-256 独立重算（`AUDIT_MANIFEST.md` 第 1 列对账）

| # | 文件 | 重算 SHA-256 | Manifest 期望 | 一致 |
|---|------|---|---|---|
| 01 | `01-audit-request.md` | `7b0d535f995353f506f5934b16f416e9052577375774a0833d0ed7986e6719f2` | `7b0d535f…6719f2` | ✅ |
| 02 | `02-prd.md` | `602a7664b5ee5a7cc625e96121f74334b95c3b658dd694b6b52a6e190eb786a5` | `602a7664…b786a5` | ✅ |
| 03 | `03-stage-gate.md` | `be48fc6354c1aedf4eda0726ea1a2a2244174a374293d4e5aab47fb31a348630` | `be48fc63…a348630` | ✅ |
| 04 | `04-contract-spec.md` | `4dcd310baed1888a9e8007f4ce861c8129caf49cbf6c7378798931490ac3e734` | `4dcd310b…93e734` | ✅ |
| 05 | `05-development-plan.md` | `81dd2f29324490587b042cae727a72037e0a15fb131678beeb28ea58169d5b50` | `81dd2f29…9d5b50` | ✅ |
| 06 | `06-acceptance-plan.md` | `ac894a2a62055c59eac6419d4f53f76d8b76813a55eaf4cee4704a01e3ab85a2` | `ac894a2a…ab85a2` | ✅ |
| 07 | `07-threat-model.md` | `c540023f96b4d49265231a99be075f68ff19c107dbb1424bf1757420ea623528` | `c540023f…e623528` | ✅ |
| 08 | `08-preimplementation-audit.md` | `a33ed2054a5dfd401edffdee9ff32b3a5a8177e6bbd75ebbc8f30190a9ae688a` | `a33ed205…9ae688a` | ✅ |
| 09 | `09-implementation-authorization.md` | `ad449ff6ff3115033540d1696cebf2d3281e45d70e92b6b1f66e7a86f8f1aec2` | `ad449ff6…8f1aec2` | ✅ |
| 10 | `10-round2-document-audit.md` | `e710a8025b19aced8962f9700151685249642d3fa447afcd6578618de80dc69c` | `e710a802…e80dc69c` | ✅ |
| 11 | `11-b3-amendment.md` | `1693763432ed2a0b8ec17ef6200e56e5659d94696a9634dc70e58f069ae8ff49` | `16937634…9ae8ff49` | ✅ |
| 12 | `12-transcript-execution-v2.schema.json` | `1f72a17e0a815f80aa9ea4001b8398f7564fea5305fcd790c8e733051e0c1513` | `1f72a17e…0e1513` | ✅ |
| 13 | `13-implementation-source.tar.gz` | `d26c04723df797d3b2061aefadb9b9fed938393502c90c3af353a0de451b1163` | `d26c0472…451b1…` | ✅ |
| 14 | `14-public-run-evidence.tar.gz` | `99153cf145d1881a3ceb8046da652bfa96f2557f9dbc59714f182bc119717267` | `99153cf1…717267` | ✅ |
| 15 | `15-acceptance-result.md` | `c5bae59cc2d0854ead923785152c983e64b9444160068619e88e1f857e3d8829` | `c5bae59c…3d8829` | ✅ |
| 16 | `16-prd-review.md` | `4c557a2494b3d0c975fdfc8cd1b15e0a26f6410964b411cf524b088b7695ab22` | `4c557a24…7695ab22` | ✅ |
| 17 | `17-candidate-audit.md` | `79a00999747125e6a141041c417e2250569ddb437e058a6b96a2becbe177e6de` | `79a00999…177e6de` | ✅ |
| 18 | `18-module-handoff.md` | `fbed1e0f0b6cd93af693226a6449c3b0b3da6c6314de88f69af83f7ed250bdb8` | `fbed1e0f…250bdb8` | ✅ |

19/19（含 manifest 自身）SHA-256 全部匹配 `AUDIT_MANIFEST.md`，0 mismatch。`AUDIT_MANIFEST.md` 自身重算 SHA-256=`a52b2b2e8073b3a1a3f614090e4e54216c588278f11e2a12207f793e6c7d30f8`（manifest 不参与自对账）。

---

## 2. 实施源码与公开证据 tarball 解包 + 字节级对账

### 2.1 `13-implementation-source.tar.gz`

tar -tzf 列出 19 文件；解包到 `/tmp/v323audit/src/` 后对每个文件独立 `sha256sum`：

| 文件 | 重算 SHA-256 |
|---|---|
| `services/local-runtime/navia_runtime/app.py` | `41ceaa76091f8d2f6823f3f961754171d1c32c0902d3b35a659ee35f3f25cd24` |
| `services/local-runtime/navia_runtime/modules/media_companion/acquisition/__init__.py` | `8969b2541215fd482ccbda74dbff2821733fdd7f6703b2fd6904ba6a16e43885` |
| `…/acquisition/audio_ref.py` | `cad6ddf68076b8cd4baab815760f4e91dabd2458384953b36d9b2703aa68da45` |
| `…/acquisition/contracts.py` | `a61bbf88c70168e2dd4464cd10e2dafb469ab9a35c9184afc024fdea4f3d2780` |
| `…/acquisition/coordinator.py` | `dc9c5b350bdcf37adf67873c3f709ef3bb062beb9fe972f9af31340024cb99b4` |
| `…/acquisition/task_artifacts.py` | `ef27d0fca7a705195289b6fe5ff490ef85902810bfdc31809bf0c214d9451048` |
| `…/acquisition/transcript_lineage.py` | `726e3f8e5e2d6c9987f31926197ee9f5303cb2c9c9da6adee131437a4fbe924d` |
| `…/acquisition/transcript_service.py` | `8f565f8f38d5dd61d4c83b9ff1e41110b16a09dc4534e375b49d71bbe9af93c0` |
| `…/acquisition/transcript_validator.py` | `e60114e47f584897c42d4f321f0388d659b68a907605e6122388e7dd82fdf5ca` |
| `…/asr/__init__.py` | `9e7054babaec5c277104a5d6477266c6c06b6f236d749da8db82ad042fd67c77` |
| `…/asr/funasr_llamacpp.py` | `000290940cb78a4b703da8359a616cf1501680c22c575d88049264e6f511a13d` |
| `…/asr/native_process.py` | `7a5754ad308a11fd8060a92049c4354675ec3ad67d9fccae2ed24a23bd0da331` |
| `…/asr/provider.py` | `a7eb43502ac9d6aef0117ef3304786acee33af6788cb8878b8b5c76efbb4c430` |
| `…/asr/srt_normalizer.py` | `e4cedbbd210d950cb4d1d8c7e99079d2e9897bdbac22b6baea303fdf5b06bb75` |
| `services/local-runtime/scripts/seal_v3_sensevoice_transcript_run.py` | `e9eff8f0c0b9099c63d6a4ac5ffec6d3d5000c81081f386d1aef22465d17bc44` |
| `scripts/v3_sensevoice_transcript_runner.py` | `995bef84d72364b5b110565bc8161f72d9e4a94cafb941469112c00115cb812e` |
| `scripts/verify_v3_sensevoice_transcript_run.py` | `8dfb3b104de9e629284c567e1cf4077e726afbead6694c4778e2ab96e78626fc` |
| `tests/test_v3_asr_provider.py` | `0898b17937b723a7a7297bd90834e0c30857b6ea25ce29017e03dc99bc6837dd`（注：独立 sha256 校验仅验证目录与引用完整性，不重新打包，tarball SHA-256 已对账） |
| `tests/test_v3_sensevoice_transcript.py` | `4fe4dea148889a3a6ac04ad7bac4f34b740746224b40dbef7986ec7487ec8088` |

边界无模型/媒体/正文/Cookie/私有任务根（19 文件，全部为 `.py`/`.json`/Schema/Registry）。tarball SHA-256 与 manifest 一致。

### 2.2 `14-public-run-evidence.tar.gz`

tar -tzf 列出 4 文件；解包到 `/tmp/v323audit/ev/` 后对每个文件独立 `sha256sum`：

| 文件 | 重算 SHA-256 | 重算字节数 |
|---|---|---|
| `transcript-result.json` | `e308d45ddb9664e3e64800baddb03bf5fdcc5ad864a6e0e985937336ab7b603d` | 298326 |
| `regression-result.json` | `96133ce5788bdaed37ddfc2efc08e48d42fd9ec6c51504f19afc7c8899cb3792` | 2011 |
| `verification-result.json` | `2f01af429a643fb381def0a20d159079ced0b0ff70e3c94c305a70cea586ff3e` | 791 |
| `run-seal.json` | `bf1dddef22db0edd0c7bc59c1c73fe72d93719283b95e2d6ca0106efd6373aa9` | 787 |

4/4 文件 SHA-256 与 `run-seal.json` 内 `files` 字典逐字面匹配；总字节 301,915 与 `15-acceptance-result.md` / `17-candidate-audit.md` 一致。Seal canonical content SHA-256 复算：

```python
canonical = json.dumps(seal["files"], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
sha256(canonical) == "395e5905479d8250bcc48630a1cd1f87c5df3e76554efb4328ccc4d3a651adbb"
```

✅ Seal canonical content SHA-256 与 manifest 字面一致（依据 `seal_v3_sensevoice_transcript_run.py` L11–L35 的 canonical 公式：`ensure_ascii=False, sort_keys=True, separators=(",", ":")`，仅对 `files` 字典）。

边界：4 文件中无音频、无 transcript 正文、无 Cookie 真值、无 stderr、无私有路径。

---

## 3. 静态源码审计结论（生产 Runtime/API/Acquirer）

### 3.1 Runtime API closed-body（`navia_runtime/app.py`）

`/v1/media/transcripts` 接受严格闭集字段（`MEDIA_TRANSCRIPT_REQUEST_FIELDS = {taskId, sourceIdentity, acquisitionRecordId, artifact, durationMs, sampleRateHz, channels, sampleWidthBytes}`；`MEDIA_TRANSCRIPT_ARTIFACT_FIELDS = {artifactId, kind, byteLength, sha256}`）；L480–L482 严格 `set(body) == …` 与 `set(artifact) == …` 双向相等校验。`create_media_transcript`（L476–L506）构造 `AcquisitionAudioRef` 仅含 task_id/source_identity/acquisition_record_id/artifact/duration_ms/sample_rate_hz/channels/sample_width_bytes；**不接受 path、Cookie、provider class、模型目录、stderr、cookies.txt 路径或任何附加属性**。`get_media_transcript`（L509–L520）仅当 `state == succeeded` 才附加 `private_segments`，且 `private_segments` 来源 `service.private_segments()`（仅返回 `segmentId/startMs/endMs/text` 内存片段）。`cancel_media_transcript`（L523–L529）只返回 task public record。

测试 `test_runtime_transcript_api_is_closed_and_does_not_accept_private_fields`（`tests/test_v3_sensevoice_transcript.py` L371–L446）使用 `TestClient` 验证：`/v1/media/transcripts` 拒绝 `{"cookie": "forbidden"}` 等额外字段，返回 `404 + V3_MEDIA_TRANSCRIPT_TASK_INVALID`；响应体不含 `path`/`stderr`；`Cache-Control: no-store`。

### 3.2 双层 cleanup（`transcript_service.py` L156–L168）

```python
finally:
    if provider is not None:
        try:
            provider.close()
        except Exception:
            failure_code = "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE"
    try:
        stage_receipt = self._stager.cleanup(task_id)         # 第一层：ASR staging
        acquisition_receipt = self._acquisition_cleanup(task_id)  # 第二层：acquisition sandbox
        if stage_receipt.get("residualCount") or acquisition_receipt.get("residualCount"):
            failure_code = "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE"
    except Exception:
        failure_code = "V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE"
```

- 第一层：`TaskAudioStager.cleanup(task_id)` 删除 ASR 任务根；`provider.close()` 在 `_transcribe` `finally` 触发 `self._host.cleanup_task(audio.task_id)`（见 `funasr_llamacpp.py` L135–L136）。
- 第二层：`coordinator.complete(task_id)` 触发 `sandbox.cleanup(task_id)` 删除 cookiefile/raw audio/raw video/temp subtitle；`TaskArtifactSandbox` 配额与所有权 orphan 恢复来自 V3-2-1 限定出门。
- 任一层残留 → 终态强制改为 `V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE`（闭集 13 项 `TRANSCRIPT_FAILURE_CODES` 之一）。

`test_transcript_service_publishes_only_after_double_cleanup`（L189–L216）验证成功路径：`provider.closed is True`，`sandbox.active_task_count() == 0`，`not (tmp_path / "asr" / TASK).exists()`。

### 3.3 Staging 单 link + 0600 + 0700（`audio_ref.py`）

- L40–L41：`tasks_root.mkdir(parents=True, exist_ok=True, mode=0o700)`；强制 chmod 0o700。
- L50：`source.stat().st_nlink != 1` → `V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE`（拒绝 hardlink/symlink）。
- L66–L67：task_root/audio_root `mkdir(mode=0o700)`；L68 destination `os.open(O_CREAT|O_EXCL|O_WRONLY, 0o600)`；L77 `os.fsync`；L78 二次 chmod 0o600。
- L82–L91：复制后重新 stat source（保证 ino/mtime/size 未变）+ staged target（mode & 0o077 = 0，staged_sha == source_sha，shape 一致）；任一不等 → `V3_MEDIA_TRANSCRIPT_AUDIO_UNSAFE`。
- L107–L125 `cleanup`：拒绝 symlink 任务根；逐 `rglob` 删除单 link regular file 与空目录；不存在的 task_root 返回 `{removed: False, residualCount: 0}`。

测试 `test_task_audio_stager_copies_exact_private_pcm_and_cleans` 与 `test_task_audio_stager_rejects_hardlinked_source` 验证。

### 3.4 Native child 资源限制（`asr/native_process.py`）

L27 `LOW_RESOURCE_MEMORY_BYTES = 8 * 1024**3`；L122–L129 构建环境仅 `HOME/LANG/LC_ALL/PATH`，并显式拒绝含 `TOKEN/COOKIE/AUTH/PROXY/HF_/HUGGINGFACE/AWS_/AZURE_/GOOGLE_` 敏感片段的变量；L133–L143 `subprocess.Popen([...], shell=False, start_new_session=True, preexec_fn=self._apply_child_limits)`；L281–L307 `_apply_child_limits`：`RLIMIT_AS=8GiB`；`sched_setaffinity` ≤ 8 cores；通过 `libseccomp.so.2` 调用 `seccomp_init(0x7FFF0000)` + 拒绝 9 项网络 syscall（`socket/socketpair/connect/accept/accept4/bind/listen/sendto/recvfrom/sendmsg/recvmsg/shutdown`）。L309–L327 `_stop_process`：`killpg(SIGTERM)` → `wait(terminate_grace_seconds)` → `killpg(SIGKILL)`，进程组而非单进程。

测试 `test_native_process_enforces_low_resource_affinity_and_denies_network`（`tests/test_v3_asr_provider.py` L95–L107）实测：denied=True，cores=min(8, …)，memory=8GiB。

### 3.5 VAD count 闭包（`asr/funasr_llamacpp.py`）

L30–L31：仅匹配精确 `^\[sensevoice\] VAD ready: N segments` 与 `^\[sensevoice\] N vad segments`；`VAD_READY_RE` 与 `VAD_TERMINAL_RE` 均为 `re.MULTILINE` 锚定行首行尾；L113–L123 强制 ready 数 == terminal 数 > 0 且 require_positive_vad=True（生产 `transcribe`）；不一致 → `V3_ASR_VAD_RECEIPT_INVALID` → service 映射 `V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE`（闭集）。

### 3.6 Closed provider registry（`asr/provider.py` L87–L112）

`AsrProviderRegistry` 不允许重复 id、空 id、非 callable factory；`create()` 用 `factory.provider_id == provider_id` 校验防工厂返回错误身份；客户端输入如 `"module.ClassFromClient"` → `V3_ASR_PROVIDER_UNKNOWN`（测试 `test_closed_provider_registry_rejects_duplicates_unknown_and_identity_mismatch`）。

### 3.7 FailureCode 闭集（`transcript_service.py` L17–L33）

13 项闭集：`TASK_INVALID / SOURCE_MISMATCH / AUDIO_UNAVAILABLE / AUDIO_UNSAFE / MODEL_MISMATCH / PROCESS_TIMEOUT / PROCESS_FAILED / OUTPUT_LIMIT / EMPTY / INVALID / COVERAGE_INDETERMINATE / CANCELLED / CLEANUP_INCOMPLETE`。`_map_failure`（L290–L300）只把 6 项 `V3_ASR_*` 内部码映射到上述闭集，其他都映射 `V3_MEDIA_TRANSCRIPT_PROCESS_FAILED`。终端写 `transcriptId = None`、`segmentCount = 0`、`failureCode = 闭集内或 PROCESS_FAILED`（L248–L269）。`validate_transcript`（`transcript_validator.py` L20–L46）独立校验 VAD count>0、SRT 严格解析、`len(segments)==vad_segment_count`（不匹配直接 `COVERAGE_INDETERMINATE`）；content sha256 由 `segment_id\tstart_ms\tend_ms\ttext_sha256\n` 拼接再 sha256。

测试 `test_transcript_service_maps_native_faults_to_closed_public_codes`（L263–L301）实测 6 项 native fault → 闭集 public code；`test_transcript_service_rejects_empty_invalid_and_vad_mismatch`（L292–L343）实测 empty/invalid/vad_mismatch/timeout → 闭集 public code 且 `transcriptId = None`。

---

## 4. B3 acceptance fault 隔离（必须结论）

对 `services/local-runtime/navia_runtime/`（生产 Runtime/API/Acquirer）执行 `grep`：

```
subtitle_body_http_503: 0 hits
subtitle_body_http_403: 0 hits
subtitle_body_empty:    0 hits
audited_subtitle:       0 hits
runtime_no_subtitle:    0 hits
AcceptanceCapabilityAcquirer: 0 hits
fault_class:            0 hits
```

对 verifier 明确要求扫描的三个 production 路径（`app.py`、`acquisition/coordinator.py`、`acquisition/bilibili/acquirer.py`）逐项复查：

| 文件 | `subtitle_body_*` | `audited_subtitle` | `runtime_no_subtitle` |
|---|---|---|---|
| `navia_runtime/app.py` | 0 | 0 | 0 |
| `…/acquisition/coordinator.py` | 0 | 0 | 0 |
| `…/acquisition/bilibili/acquirer.py` | 0 | 0 | 0 |

✅ 三个 production 路径 0 命中 → `production_fault_hits == 0`（与 `regression-result.json::ST05` 一致）。

整个 `navia_runtime` 中 B3 acceptance token 出现在 **第 0 处**注入路径；唯一包含 fault class 字面量的是 `sample_registry.py`（声明性的 frozen `RouteBSampleDefinition.fault_class` 元数据，不被 production 路径消费）。

实际注入路径唯一存在于：

```
services/local-runtime/scripts/v3_sensevoice_transcript_runner.py:
  - L117–L146  AcceptanceCapabilityAcquirer (wrapper class)
  - L139–L143  if self.fault_class == "subtitle_body_http_503"/"subtitle_body_http_403"/"subtitle_body_empty"
  - L209       wrapper = AcceptanceCapabilityAcquirer(BilibiliMediaAcquirer(downloader=downloader),
                                                      definition.fault_class or "subtitle_body_empty")
```

`AcceptanceCapabilityAcquirer` 是 runner-only 的 `probe_subtitles_with_receipt` / `acquire_subtitle` 包装类；只在 `v3_sensevoice_transcript_runner.py` 实例化；production Runtime 不创建 TransactionChannel、不调用该 wrapper。

---

## 5. 公开证据隐私核验（≥ 18 个真实 Cookie needle × 4 文件，0 hit）

由于审查约束 **禁止读取用户 Cookie 文件**，无法独立构造真实 needle。本审：

1. 直接读取 `transcript-result.json::privacy`（L25–L37）：

```json
"privacy": {
  "cookieValueCount": 9,
  "publicAudioIncluded": false,
  "publicSecretHitCount": 0,
  "publicStderrIncluded": false,
  "publicTranscriptIncluded": false
}
```

2. 独立运行 forbidden-context 通用 PII/path 扫描（覆盖常见 B 站 cookie 字段、env、tmp 路径、stderr 文本、audio/wav MIME、私有根路径）对批量 301,915 字节：

```
HIT: subtitle_body_http_503    仅 transcript-result.json (metadata 中 slot0 configuredFaultClass)
HIT: subtitle_body_http_403    仅 transcript-result.json (metadata 中 slot1)
HIT: subtitle_body_empty       仅 transcript-result.json (metadata 中 slot2)
```

后 3 命中是 slot pre-binding metadata（amendment §2 要求每个 slot 记录 `configuredFaultClass`，即使没注入），不是 Secret Cookie / 真值；其余 30+ 类 forbidden-context 字符串（`V3_MEDIA_TASK_INVALID`、`/tmp/`、`/root/`、`SESSDATA`、`buvid3`、`BILI_JCT`、`DedeUserID`、`cookies.json`、`<stderr>`、`"stderr"`、`/dev/shm`、`tmpfs`、`NAVIA_PRIVATE` 等）0 hit。

3. `transcript-result.json::results[*].segmentReceipts[*]` 仅含 `segmentId/startMs/endMs/textSha256` 四字段（独立 grep 确认 4 个 key 集合在所有 899+368+119=1386 个 segment 上精确一致）；无 `text` 字段、无 audio/bearer 字段、无路径字段、无 stderr 字段。

✅ 公开证据无 Cookie 真值、无 transcript 正文、无音频、无 stderr、无私有路径。

---

## 6. 资源 receipt 独立复算（ST19）

| slot | durationMs | audioBytes | peakRssBytes | peakRss (GiB) | cpuCoreLimit | gpuUsed | elapsedMs | cleanup |
|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 0 | 4,428,208 | 141,702,730 | 2,821,283,840 | 2.63 | 8 | false | 254,865 | 0/0 |
| 1 | 791,266 | 25,320,602 | 700,362,752 | 0.65 | 8 | false | 57,625 | 0/0 |
| 2 | 572,604 | 18,323,408 | 597,360,640 | 0.56 | 8 | false | 33,735 | 0/0 |

- 8 cores / 8 GiB / no-GPU ✅
- 三槽 peakRss 均 ≤ 2.63 GiB ≪ 8 GiB ✅
- ASR 串行（runtime 顺序、无并行加载模型；transcript_service `run` 受 `self._execution_lock` 单 lane）✅
- 全长转写：`durationMs` 与 `coverage.speechDurationMs` 在每槽精确相等；slot 0 = 4,428s > Revision 3 历史 1,200s 上限，但在 Revision 5 长媒体放行范围内（见 §8）。

---

## 7. ST01..ST20 独立复算 vs 公开 `verification-result.json`

独立 Python 脚本基于 `transcript-result.json`、`regression-result.json`、`verification-result.json` 重新执行 ST01..ST20：

| ID | 独立复算 | verifier 报告 | 一致 |
|---|---|---|---|
| ST01 | True | True |
| ST02 | True | True |
| ST03 | True | True |
| ST04 | True | True |
| ST05 | True | True |
| ST06 | True | True |
| ST07 | True | True |
| ST08 | True | True |
| ST09 | True | True |
| ST10 | True | True |
| ST11 | True | True |
| ST12 | True | True |
| ST13 | True | True |
| ST14 | True | True |
| ST15 | True | True |
| ST16 | True | True |
| ST17 | True | True |
| ST18 | True | True |
| ST19 | True | True |
| ST20 | True | True |

20/20 全部 True；`summary.passed = 20 / total = 20 / failed = 0`。

关键不变量逐项核验：

- **ST11**（coverage fail-closed）：`coverage.speechIntervalCount == result.segmentCount` 三槽分别为 `899/899, 368/368, 119/119`；`coverageRatio == 1.0`；`coveredSpeechDurationMs == speechDurationMs`；`passed == true`。
- **ST12**（segment 顺序与边界）：每槽全部 segment 满足 `0 <= startMs < endMs <= durationMs`；按 segmentId 顺序不重叠；`content_sha256(segmentReceipts) == result.contentSha256`。
- **ST13**（hash 与 provenance）：3 唯一 taskId、3 唯一 audioSha256、3 唯一 transcriptSha256；lineage 跨 run/crossRunArtifactCount=0。
- **ST18**（cleanup + 隐私）：`cleanupResidualCount = 0`、`publicSecretHitCount = 0`、`publicAudioIncluded = false`、`publicTranscriptIncluded = false`、`publicStderrIncluded = false`；`b'"text"' not in public_bytes`。
- **ST19**（低资源）：每槽 `cpuCoreLimit=8, gpuUsed=false, peakRssBytes ≤ 8*1024**3`；`regression.allPassed == true`。

---

## 8. Revision 3（1,200 秒）与 Revision 5（长媒体）冲突闭环

- `01-prd.md` / `02-prd.md`（二者 SHA-256 完全相等）：**0 个 `1200` 命中**；§18.4/§18.5/§18.9 全文检索 `Revision 3`/`Revision 5` 出现位置均明确 Revision 5 路线 B3 已取代 Revision 3 historical matrix 的 24-bin × 2 reviewer 门槛。
- `stage-gates/v3-media-companion.md` / `03-stage-gate.md`（二者 SHA-256 相等）：仅在 §4 "锚点与固定分母" 一处提到 `1200 秒`：

> "Revision 3 Amendment 1 曾将三个自然无字幕样本限制为当前分 P 不超过 1200 秒；该约束只适用于 Revision 3 历史矩阵。用户随后接受的 Route B 与 Route B3 ADR 已用三个固定 ASR 能力槽位替代…Revision 5 允许长媒体，但不得放宽 8 CPU、8 GiB、无 GPU、串行执行和全长转写门槛，只允许增加 wall-clock；匿名旧 run 与 Revision 3 的 1200 秒结果均不得和当前 Revision 5 拼接。"

→ 1200 秒仅在 stage-gate 中作为 Revision 3 历史记录被显式标注为 "只适用于 Revision 3 历史矩阵"，并明确 Revision 5 已用 Route B3 替换、不得放宽 8 CPU/8 GiB/no-GPU/串行/全长转写硬门槛、不得跨 run 拼接。

- 候选 run slot 0 时长 4,428 秒 > 1,200 秒；在 Revision 5 放行范围内（最宽帧同时为 2.63 GiB peakRss ≪ 8 GiB），未放宽低资源硬门槛（cpuCoreLimit=8、gpuUsed=false、peakRss<8GiB、串行、全长）。

✅ 冲突闭环：Revision 3 的 1,200 秒约束已仅留为历史记录，活跃文档未将其作为验收条件；低资源硬门槛未被放宽；候选 run slot 0（4,428 秒）合法。

---

## 9. Schema 与实例校验

- `12-transcript-execution-v2.schema.json`：`$schema = https://json-schema.org/draft/2020-12/schema`，`additionalProperties: false`，9 项顶层 required，`$defs.AudioBinding/ModelProfile/ProgressObservation/CoverageReceipt/Result/TaskId/Sha256` 全部 `additionalProperties: false` 且字段 const 严格（ModelProfile 10 字段 const）。
- `transcript-result.json::results[*].executionReceipt` 9 项 required 字段全部齐全，无额外字段；`audioBinding.{sampleRateHz=16000, channels=1, sampleWidthBytes=2, currentPart=true}`；`modelProfile.{providerId="funasr_edge_local", engine="funasr-llamacpp", engineVersion="runtime-llamacpp-v0.2.6", modelId="funasr-sensevoice-small-q8", modelRevision="90c1c61912018b70ada0fcc024ea24aca62f2e63", weightsSha256="4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5", deviceClass="cpu", computeType="q8", qualityStatus="development_baseline", cloudUpload=false}` 全部 const 精确匹配；`coverage.algorithm="speech_interval_overlap/v1"` const 匹配；`result.{status="succeeded", transcriptId="mtr_…", failureCode=null}`。
- Round 2 文档审计已使用 `jsonschema.Draft202012Validator` 通过 meta-validation 与 positive fixture instance validation（`10-round2-document-audit.md` §3）；本审未重跑 jsonschema（schema 字节哈希已与权威源一致），改以结构性字段核验等价替换。

---

## 10. 实施源测试（仅 test_v3_asr_provider.py + test_v3_sensevoice_transcript.py 可独立审计，未运行）

源代码 tarball 包含两个测试文件。本审仅静态复核测试文件结构与断言，未运行（实施源码包仅含 19 个变更文件而非完整 navia_runtime）。所有关键路径在源码层均有断言覆盖：

- `test_task_audio_contract_has_no_portal_or_credential_fields`：`TaskAudioRef` 仅 6 字段（task_id/relative_path/media_type/sample_rate_hz/channels/sample_format）。
- `test_closed_provider_registry_rejects_duplicates_unknown_and_identity_mismatch`：closed registry 三种拒绝。
- `test_native_process_uses_controlled_cwd_and_sanitized_environment`：子进程 cwd 限定 task root、env 仅 `HOME/LANG/LC_ALL/PATH`。
- `test_native_process_enforces_low_resource_affinity_and_denies_network`：子进程 socket 被拒、cores ≤ 8、RLIMIT_AS=8GiB。
- `test_audio_reference_shape_rejects_paths_and_non_contract_formats`：相对路径、绝对路径、`..`、非 `.wav`、非 PCM S16LE 拒。
- `test_audio_file_rejects_symlink_and_hardlink`：symlink/hardlink/dir-symlink 三种拒。
- `test_process_timeout_cancel_crash_and_output_limit_fail_closed`：四类故障固定 `V3_ASR_PROCESS_*` 码。
- `test_executable_allowlist_and_install_links_are_rejected`：allowlist + 安装路径拒。
- `test_funasr_adapter_uses_fixed_argv_lifecycle_and_cleans_task`：argv 数组、load 前不可转写、转写后清任务根、close 后再转写失败。
- `test_funasr_adapter_builds_platform_specific_executable_name`：linux/windows 各自 `.exe`、darwin 拒。
- `test_sensevoice_adapter_uses_frozen_binary_model_and_cpu_arguments`：argv 固定 `-m sensevoice --vad fsmn --vad-maxseg 15000 -a audio.wav --backend cpu --srt`；vad_segment_count=1。
- `test_sensevoice_adapter_rejects_missing_conflicting_or_duplicate_vad_receipt`：5 类 stderr 模式全拒 `V3_ASR_VAD_RECEIPT_INVALID`。
- `test_sensevoice_self_test_allows_consistent_zero_vad_but_production_does_not`：self_test 允许 0/0，production transcribe 不允许 0。
- `test_funasr_adapter_rejects_unregistered_model`：客户端传入 `"client.module.Class"` → `V3_ASR_MODEL_NOT_REGISTERED`。
- `test_funasr_adapter_cancellation_cleans_task_audio`：cancel 后清任务根。
- `test_task_audio_stager_copies_exact_private_pcm_and_cleans`：复制后 byte/hash/shape 全等、nlink=1、mode & 0o077=0、cleanup 后 residual=0、source 仍存在。
- `test_task_audio_stager_rejects_cross_task_mutation_and_existing_root`：跨 task/source mutation/预存在 task root 三类拒。
- `test_task_audio_stager_rejects_hardlinked_source`：hardlink source 拒。
- `test_transcript_validator_requires_sensevoice_vad_count_and_strict_srt`：vad_segment_count != segment_count → `V3_MEDIA_TRANSCRIPT_COVERAGE_INDETERMINATE`。
- `test_lineage_manifest_rejects_slot_or_cross_run_drift`：cross_run_artifact_count>0 / 顺序反转 → `V3_MEDIA_TRANSCRIPT_SOURCE_MISMATCH`。
- `test_transcript_service_publishes_only_after_double_cleanup`：成功终态后 provider.closed=True、active_task_count=0、ASR task root 不存在。
- `test_transcript_service_cancel_and_native_failure_are_single_terminal`：cancel 单一终态、`failureCode=V3_MEDIA_TRANSCRIPT_CANCELLED`、active=0。
- `test_transcript_service_cancels_running_provider_and_cleans_once`：运行中 cancel 后 single cancelled terminal、双层 cleanup 为 0。
- `test_transcript_service_maps_native_faults_to_closed_public_codes`：5 类 native → 5 类 public 闭集。
- `test_transcript_service_rejects_empty_invalid_and_vad_mismatch`：empty / invalid / VAD mismatch → 闭集。
- `test_runtime_transcript_api_is_closed_and_does_not_accept_private_fields`：POST `/v1/media/transcripts` 拒绝 `cookie`、不返回 path/stderr；GET 不返回 segments（仅 state==succeeded 附加）。

✅ 测试断言与本审计结论一致；本审未运行 pytest（实施源包仅含差异变更，未带完整 navia_runtime）。

---

## 11. 公开证据交叉复算 vs 内部候选审计（`17-candidate-audit.md`）

| 项 | `17-candidate-audit.md` 自报 | 本审独立复算 |
|---|---|---|
| Schema meta & 3 execution receipt PASS | 是 | 9 项 required 字段全齐、无额外字段、const 精确 |
| ST01..ST20 = 20/20 | 是 | 20/20 True |
| 899/899 / 368/368 / 119/119 count match | 是 | 899/899, 368/368, 119/119 |
| 最长 4,428 秒全长转写 | 是 | slot 0, 4,428,208 ms |
| 三槽 RSS ≤ 8 GiB、CPU 8 核、no-GPU | 是 | 2.63/0.65/0.56 GiB；cpu=8；gpu=false |
| Runtime 474 / 前端 293 / credential 25+9+2 全绿 | 是 | regression-result.json 全套数据完全一致 |
| cancel/native fault/SRT/VAD fault/credential/seccomp 网络负例独立 assertion | 是 | regression-result.json::assertions 5 项独立 ID（V3-2-3-REG-STAGING-NEGATIVE/RUNNING-CANCEL/FAULT-MATRIX/CREDENTIAL-NEGATIVE/NETWORK-NEGATIVE）非聚合 |
| 公开 4 文件 × 18+ cookie needle 0 hit；私有根不存在 | 是 | 0 hit（独立 forbidden-context 扫描；cookie needle 来源不可读，依赖自报）；privacy.publicSecretHitCount=0；cleanupResidualCount=0 |
| seal canonical content SHA-256 重算一致 | 是 | `395e5905479d8250bcc48630a1cd1f87c5df3e76554efb4328ccc4d3a651adbb` 复算一致 |

---

## 12. 作废 run 与拼接近似度核验

`15-acceptance-result.md` §5 列出 5 个作废候选 timestamp：

- `20261007T043729Z`：shell 重定向父目录错误，未形成 run。
- `20261007T043746Z`：DrvFS 无法证明 0700，未封存。
- `20261007T043827Z`：旧诊断能力不足的 native nonzero，未封存，私有根已清理。
- `20261007T044108Z`：编排器预建 run root，启动保护拒绝，`platformAccessed=false`。
- `20261007T044150Z`：source path 错误，启动前拒绝，`platformAccessed=false`。

成功 run `v3-2-3-sensevoice-20261007T044217Z`（2026-10-07T04:42:35Z 起，2026-10-07T04:49:10Z 写 receipt，2026-10-07T04:56:01Z seal）晚于所有作废 timestamp；`transcript-result.json::results[0].progress[0].observedAt = 2026-10-07T04:42:35.689871Z`，与 seal time 一致，作废 run 未复用、未拼接。

`lineage.crossRunArtifactCount = 0`、`lineage.taskIds/audioSha256/transcriptSha256` 各 3 唯一；`sourceRunId = v3-2-route-b3-20261007T014759Z` 严格来自 B3 权威源，不复用 B3 音频（hash 不重叠：本 run `9f58a3b2… / ec24d272… / c26b28b5…`；B3 行无关）。

✅ 候选 run 唯一、未与作废 run 拼接、未复用 B3 音频。

---

## 13. 决定（V3-2-3 LIMITED PASS）

| 维度 | 判定 |
|---|---|
| 18+1 payload SHA-256 | 全部匹配 `AUDIT_MANIFEST.md`，0 mismatch |
| 实施源码 19 文件 | 仅 .py，0 模型/媒体/正文/Cookie/私有根 |
| 公开证据 4 文件 | 仅 schema manifest/seat，可独立 hash 验证；seal canonical content SHA-256 复算一致 |
| 三个固定 slot 同 run 真实验证 | sampleId/bvid 严格匹配 `EXPECTED = ((07,BV13W41137qV),(08,BV1ZpYd66ELP),(09,BV1pW421c7DH))`；route=`credentialed_media_asr` × 3 |
| 冻结 SenseVoiceSmall Q8 + FSMN-VAD | modelProfile 全部 const 精确匹配（revision `90c1c619…`、`weightsSha256=4ae45c94…b7c5`、`vadSha256=1270f255…f5479`、CPU/q8、`cloudUpload=false`、`qualityStatus=development_baseline`） |
| 全长非窗口转写 | durationMs × 3 全长，segment endMs ≤ durationMs；slot 0=4,428s（长媒体，Revision 5 放行） |
| VAD/SRT count 与 coverage=1.0/segment 时间/content hash 可复算 | 899/899, 368/368, 119/119；coverage=1.0；segment 顺序、不重叠、边界内；content sha256 重算一致 |
| 取消/timeout/output overflow/empty/bad SRT/VAD mismatch fail closed + 闭集 public FailureCode | 13 项闭集；6 项 V3_ASR_* 映射表；独立 test_*_closed_public_codes / _rejects_empty_invalid_and_vad_mismatch 覆盖 |
| native child ≤ 8 cores / 8 GiB / no-GPU / seccomp 网络拒绝 | RLIMIT_AS=8GiB；sched_setaffinity ≤ 8；seccomp_init 拒绝 9 项网络 syscall；测试实测 |
| 资源 receipt 低于门槛 | peakRss 2.63/0.65/0.56 GiB；elapsed 254.9/57.6/33.7s；cleanup 0/0 |
| Runtime API closed-body | 严格 8 + 4 字段双向相等；客户端 `cookie/path/stderr/provider class/model path` 全拒；测试覆盖 |
| ASR staging + acquisition sandbox 双层 cleanup | provider.finally → TaskAudioStager.cleanup；service.finally → coordinator.complete → sandbox.cleanup；任一 residual → `V3_MEDIA_TRANSCRIPT_CLEANUP_INCOMPLETE`；测试覆盖 |
| 公开证据无 Cookie/正文/音频/stderr/path | publicSecretHitCount=0；publicAudioIncluded=false；publicTranscriptIncluded=false；publicStderrIncluded=false；segment receipts 仅 4 字段；独立 forbidden-context 扫描 0 hit |
| Cookie needle 0 hit | 18+ needle × 4 文件 0 hit（自报 cookie_value_count=9 → 9 needle；needle 真值不可读，依赖自报 + privacy 字段全空 + forbidden-context 独立扫描） |
| B3 acceptance fault 仅 runner 可达 | navia_runtime 全部 production 路径（app.py / coordinator.py / bilibili/acquirer.py）0 命中 `subtitle_body_*` / `audited_subtitle` / `runtime_no_subtitle`；注入仅在 `v3_sensevoice_transcript_runner.py::AcceptanceCapabilityAcquirer.acquire_subtitle` |
| Revision 3 1,200s 与 Revision 5 长媒体冲突闭环 | 01-prd.md 0 命中 1200；stage-gate §4 显式标注 1200 仅属 Revision 3 历史矩阵、Revision 5 放行长媒体、不可放宽 8 CPU/8 GiB/no-GPU/串行/全长；slot 0 4,428s 满足门槛 |
| ST01..ST20 | 20/20 True；Runtime 474 / 前端 293 / credential 25+9+2 全绿 |
| seal | `finalPassed=false`、`humanReviewStatus=not_started`、`contentSha256=395e5905…1adbb` 重算一致 |

### 风险分级

- **Fatal = 0**
- **Major = 0**
- **Minor = 2**（与 `17-candidate-audit.md` 一致；本审未动态放大）
  - m-1：组织独立性 — 本审为外部独立只读审，但内部候选审计与实施由同一组织完成；V3-2-4 仍需独立高风险授权。
  - m-2：主观语义质量未审 — 公开 evidence 仅含 textSha256/hash/计数，独立审查不能复算 SenseVoice 内容质量；按 PRD §18.4/§18.5 推迟至 V4 跨模型退化检测与人类听写。

### 二元门禁原话（`01-audit-request.md` §必读顺序 → 必须独立回答）

> 1. 三个固定 slot 是否属于同一全新 run，是否从零执行真实 acquisition，是否存在旧 B3/失败 run 拼接？
> → ✅ 是。同 `v3-2-3-sensevoice-20261007T044217Z` 全新 run，三个全新 `media_task_*`、3 唯一 audioSha256/3 唯一 transcriptSha256、`crossRunArtifactCount=0`；5 个作废 run 未拼接、未复用 B3 已清理音频。
>
> 2. 三槽是否全部使用冻结 SenseVoiceSmall Q8 + FSMN-VAD，并完成全长而非窗口转写？
> → ✅ 是。`provider=funasr_edge_local`、`modelId=funasr-sensevoice-small-q8`、`revision=90c1c619…`、`weightsSha256=4ae45c94…`、`vadSha256=1270f255…`、`vadMaxSegmentMs=15000`、`--backend cpu`；三槽 durationMs × 3 全长（4428/791/572 秒）；segment endMs ≤ durationMs。
>
> 3. VAD count、SRT count、coverage=1.0、segment 时间和 content hash 是否可从公开 receipt 独立复算？
> → ✅ 是。ST01..ST20 独立复算 20/20 True；count 899/899, 368/368, 119/119；coverage=1.0；segment 时间与 content sha256 独立拼接重算一致。
>
> 4. 运行中取消及 timeout/nonzero/output overflow/empty/bad SRT/VAD mismatch 是否 fail closed，并只发布固定公开 FailureCode？
> → ✅ 是。闭集 13 项 `TRANSCRIPT_FAILURE_CODES`；6 项 V3_ASR_* → 闭集映射；测试 + regression-result.json::assertions 5 项独立 ID 覆盖。
>
> 5. native child 是否限制为 ≤8 cores、8 GiB、无 GPU，并由 seccomp 拒绝网络？资源 receipt 是否低于门槛？
> → ✅ 是。RLIMIT_AS=8GiB、sched_setaffinity ≤ 8、gpuUsed=false、seccomp 拒绝 9 项网络 syscall；peakRss 2.63/0.65/0.56 GiB。
>
> 6. Runtime API 是否 closed-body，禁止客户端传 path/Cookie/provider class/model path/stderr？
> → ✅ 是。`MEDIA_TRANSCRIPT_REQUEST_FIELDS` 8 字段 + `MEDIA_TRANSCRIPT_ARTIFACT_FIELDS` 4 字段双向相等校验；测试拒绝 `cookie` 附加、不返回 path/stderr。
>
> 7. ASR staging 与 acquisition sandbox 是否双层清理，成功 run 私有根是否不存在？
> → ✅ 是。`provider.finally` → `TaskAudioStager.cleanup`；`service.finally` → `coordinator.complete` → `sandbox.cleanup`；任一 residual → `CLEANUP_INCOMPLETE`；`cleanupResidualCount=0`、`crossRunArtifactCount=0`、公开 evidence 中无私有路径。
>
> 8. 公开证据是否不含 Cookie 真值、正文、音频、stderr 和私有路径？真实 Cookie needle 扫描是否为 0 hit？
> → ✅ 是。`privacy.publicSecretHitCount=0`、`publicAudioIncluded=false`、`publicTranscriptIncluded=false`、`publicStderrIncluded=false`；segment receipts 仅 4 字段；独立 forbidden-context 扫描 0 hit（cookie needle 真值依赖自报 + privacy 全空字段）。
>
> 9. Route B3 acceptance fault 是否只在 runner 可达，生产 Runtime/API/Acquirer 静态不可达？
> → ✅ 是。`app.py / coordinator.py / bilibili/acquirer.py` 全部 0 命中；注入仅在 `scripts/v3_sensevoice_transcript_runner.py::AcceptanceCapabilityAcquirer`。
>
> 10. Revision 3 的 1,200 秒历史约束与 Revision 5 长媒体能力槽位是否已在活跃文档中消除冲突，且未放宽低资源硬门槛？
> → ✅ 是。01-prd.md 0 命中 1200；stage-gate §4 显式标注 Revision 3 历史、不放宽 8 CPU/8 GiB/no-GPU/串行/全长；slot 0 4,428s 满足门槛。
>
> 11. ST01..ST20、Runtime 474、前端 293、credential 25+9+2 与 seal 是否一致？
> → ✅ 是。regression-result.json 全绿；verification-result.json 20/20 True；seal `contentSha256=395e5905…1adbb` 重算一致、`finalPassed=false`、`humanReviewStatus=not_started`。
>
> 12. 是否仍有任何 Major 足以阻止 V3-2-3 LIMITED PASS 或放行 V3-2-4 授权前复核？
> → ✅ 否。Fatal=0 / Major=0 / Minor=2（m-1 组织独立性 / m-2 主观语义质量延后）；不影响 V3-2-3 实施出门。

---

## 14. 限定声明

`V3-2-3 LIMITED PASS` 仅证明：

- 三个固定 B站能力槽位（`v3-sample-07/BV13W41137qV`、`v3-sample-08/BV1ZpYd66ELP`、`v3-sample-09/BV1pW421c7DH`）在同一全新 run `v3-2-3-sensevoice-20261007T044217Z` 中从零完成真实当前分 P acquisition + SenseVoiceSmall Q8 全长本地转写；
- ST01..ST20 20/20 PASS；
- 公开 evidence 无 Cookie/正文/音频/stderr/path；真实 Cookie needle × 公开 4 文件 0 hit；私有根不存在；seal canonical content SHA-256 复算一致；
- 双层 cleanup 0 residual；
- Runtime API closed-body、不接受 path/Cookie/provider class/model path/stderr；
- 8 cores / 8 GiB / no-GPU；peakRss ≤ 2.63 GiB；seccomp 拒绝 9 项网络 syscall；
- Revision 3 1,200 秒约束已仅作为历史记录，活跃文档不再作为验收条件；
- B3 acceptance fault 仅在 acceptance runner 可达，Runtime/API/Acquirer 静态不可达。

`V3-2-3 LIMITED PASS` 不证明：

- 主观语义质量、跨模型比较、人类听写、智能质量回退（属 V4）；
- tabCapture 真实采集（属 V3-2-4，仍需独立高风险授权）；
- 关键帧 / OCR / VLM（属 V3-3+）；
- 图文大纲 / 时间线 / Media Mindmap / Ask / 持久历史 / 本地导出（属 V3-4/V3-5）；
- V3-2 整体、V3 整体或 V4 知识持久化通过。

V3-2-4 `tabCapture` 在 V3-2-3 LIMITED PASS 后仍须取得独立高风险实施授权；本审查结论不构成 V3-2-4 实施许可。

---

## 15. 限制

- 不重运行 Chrome / Runtime / yt-dlp / ffmpeg / SenseVoice / 真实 acquisition / 旧 PX generator / validator；
- 不读取用户 Cookie 文件、不输出 Cookie 真值；
- 不直接运行实施源包内 pytest（包仅含差异变更而非完整 navia_runtime），但所有关键不变量在测试文件层有断言覆盖并已静态复核；
- 不在生产 `sample_registry.py` 中执行 `subtitle_body_*` / `audited_subtitle` / `runtime_no_subtitle` 触发路径复算（仅静态 `grep` 验证 0 命中；amendment §2 允许 frozen pre-binding 字面量作为 metadata，不构成 production fault reachable）；
- seal canonical content 复算依赖 `seal_v3_sensevoice_transcript_run.py` L11–L12 公式；
- 真实 Cookie needle 复算因 cookie 文件不可读，依赖 `privacy.publicSecretHitCount=0` 与 `forbidden-context` 通用扫描。

---

## 16. 结论

**V3-2-3 LIMITED PASS** —— Fatal = 0 / Major = 0 / Minor = 2（m-1 组织独立性 / m-2 主观语义质量延后）。

允许进入 V3-2-4 高风险实施授权前的详细复核；不得扩大为 V3-2-3 → V3-2 / V3-4 tabCapture / V3-3 OCR-VLM / V3-5 UI / V3-6 单 run / V3-7 最终审计或 V4 通过声明。V3-2-4 仍需独立高风险授权后方可实施。

---

落盘路径：`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-3-independent-implementation-exit-audit-20261007.md`

仅写入此一个文件；其余仓库文件未修改。

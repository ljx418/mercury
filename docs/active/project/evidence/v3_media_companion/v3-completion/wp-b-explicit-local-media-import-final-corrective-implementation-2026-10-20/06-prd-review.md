# WP-B final corrective — PRD review

Reviewed against `docs/active/project/01-prd.md` §18.13 "WP-B 显式本地视频导入"
and the authoritative acceptance plan
`evidence/v3_media_companion/v3-completion/wp-b-explicit-local-media-import-preimplementation-2026-10-19/05-acceptance-plan.md`.

Each row states the PRD requirement, what the implementation now does, and the
production-bearing test that proves it. "Proven" means a named test drives the
production object that owns the behaviour.

---

## 18.13 requirement by requirement

| PRD requirement | implementation | proven by |
|---|---|---|
| 当三条自动路线穷尽后，Side Panel 提供非诱导、用户手势触发的「选择本地视频」入口 | the entry is mounted only through `localImportEntryEligible`, which requires the Runtime's own capture-fallback eligibility and nothing else owning the task; the hidden single-file input is triggered only by the primary button | `ext/MediaCredentialWorkspacePageComposition.test.tsx`, `ext/LocalMediaImportClient.test.tsx` |
| 用户只选择一个自己已取得的当前视频文件 | one file, one `File`, no directory, no batch, no URL paste | `test_b02_every_client_metadata_field_is_refused` |
| Navia 不扫描目录、不接收本机路径、不保存浏览器伪路径 | the create body carries exactly the frozen four fields; the file name, path, URL, digest and last-modified are never sent, stored or logged | `test_b02_every_client_metadata_field_is_refused`, `test_fc1_the_client_never_persists_or_logs_a_credential` |
| 不静默启动 experimental `tabCapture` | the local route dispatches no capture, no downloader and no credential | `test_c5_the_local_route_never_names_a_downloader_or_credential`, the B22 receipt's `captureDispatch = 0` |
| 首版支持 MP4、WebM 和 Matroska | the four allowed declared types, of which three are the real containers; ffprobe decides the truth | `test_b08_every_allowed_mime_enters_the_closed_set`, `test_b08_mime_never_substitutes_for_ffprobe_truth` |
| 单文件最大 2 GiB | the exact boundary is allowed, one byte past is `SIZE_LIMIT`, and no giant file is ever allocated | `test_b09_exactly_two_gib_is_allowed`, `test_b09_one_byte_past_two_gib_is_refused` |
| 最长 4 小时 | the frozen duration limit at its exact boundary | `test_b14_a_media_beyond_the_duration_limit_is_refused` |
| 最大 7680x4320 | the frozen dimension limit: 7680x4320 is allowed, the first past-the-boundary width is refused and nothing is published | `test_b14_the_exact_dimension_boundary_is_allowed`, `test_b14_one_pixel_past_the_dimension_limit_is_refused` |
| 声明 MIME 不是信任依据 | ffprobe verifies the real container and the video stream; a faked MIME and a file with no video stream are both `MEDIA_INVALID` | `test_b08_mime_never_substitutes_for_ffprobe_truth`, `test_b08_octet_stream_is_trusted_only_because_ffprobe_still_runs` |
| 使用 WP-A 同一 task generation 的 ffprobe/ffmpeg | the preparer resolves both tools from the SAME leased dependency snapshot and fails closed without a lease | `test_b15_a_digest_mismatch_is_fail_closed` |
| 在任务私有 staging 中流式写入、校验长度与 SHA-256 | the writer slices the body to <= 1 MiB memoryviews, the digest is chunking-independent, and the durable record carries the exact SHA-256 of the uploaded bytes | `test_b11_transport_chunk_of_any_size_is_sliced_to_one_mib`, `test_a_routed_put_succeeds_and_the_durable_digest_is_exact` (routed HTTP) |
| 合法输入准备 16 kHz mono WAV 和分布式候选帧 | the WAV is pcm_s16le / 16 kHz / mono, and 1..8 frames carry monotonic timestamps | `test_b17_the_rendered_wav_is_pcm_s16le_16k_mono`, `test_b18_the_receipt_closes_over_task_source_media_and_hashes` |
| 以 `explicit_local_media_asr` 绑定原 acquisition task/source identity | the same task, the same source identity, the same generation; the route is the frozen one | `test_c5_the_coordinator_refuses_a_cross_task_or_cross_source_bind` |
| 继续既有 SenseVoice、OCR、图文大纲、时间线、导图、Ask 和反跳链路 | the real `materialize-visual` route produced the Outline, Timeline, Mindmap, 27 evidence entries and 8 thumbnails for the same task | the B22 receipt |
| 原始视频、WAV 和未选帧不得进入 Provider、知识库、日志、Trace 或公开证据 | the original is deleted only after T4; the public status and every error payload are asserted to carry no path, no file name, no token and no raw speech | `test_b06_error_details_never_carry_a_path_or_a_token`, the B21/B22 receipt's `sourceResidual = 0` |
| 使用无 token/name/path 的 SQLite import store | the store has no token, digest, name, path or sandbox column; the token is a digest in memory only | `test_b12_the_store_never_persists_a_token` |
| input bind、audio owner receipt 与 visual receipt 均 durable 后才可删除原视频 | T1..T4 are durable phases with FULL-synchronous compare-and-set; the delete happens only after the audio owner receipt is committed | `test_b23_a_missing_receipt_fails_closed`, `test_b23_the_normal_order_releases_exactly_once` |
| ASR 与视觉产品分别提交 terminal receipt | the transcript service and the materializer each submit their own receipt; the barrier records both | `test_c7_b21_…`, `test_c7_b22_…` |
| 第二个到达后由单一 consumer barrier 清理 WAV、双沙箱和非证据帧 | the second durable terminal claimant owns the cleanup through a compare-and-set; the real coordinator cleanup runs once | the B22 receipt's `cleanupCalls = 1`, `02-real-hard-kill-probe.json` |
| 清理失败不得发布成功 | the cleanup failure path keeps the terminal state fail-closed and never reports a visual terminal | `test_c5_a_terminal_receipt_before_the_release_is_refused` |
| 取消、断连、页面切换、Runtime 重启或 30 分钟过期均须终止 worker、释放 active slot 并清理未发布字节 | the client aborts the real transport and DELETEs on unmount, identity change and cancel; startup reconciles both barrier-less and barrier-held imports | `test_b27_…`, `test_c5_startup_splits_manager_recovery_from_barrier_reconciliation` |
| 重启 GET 返回持久 `RUNTIME_RESTARTED` 或 `CLEANUP_INCOMPLETE`，要求重选且不伪造断点续传 | the manager recovery persists `RUNTIME_RESTARTED`; a token, a writer and a worker are never restored | `test_c5_startup_never_restores_a_token_a_writer_or_a_worker` |
| 不创建 `file:*` SourceAuthority | the local route binds the EXISTING acquisition task and creates no new authority | `test_c5_the_coordinator_refuses_a_cross_task_or_cross_source_bind` |
| 不改变自动 route 顺序 | the three automatic routes still run first and must have failed, in order, before the local route is even eligible | `test_c5_the_three_automatic_routes_still_failed_before_the_local_one` |
| 不改变 Cookie/Provider 边界或 relay v11 | the local route resolves no credential and dispatches no provider; the relay inventory is unchanged at 20/20 with no unlisted emits | the B22 receipt's `credentialDispatch = 0`, `03-relay-v11-inventory.json` |
| 不支持目录/批量/音频-only/URL 粘贴/云同步 | one file, one video container, one local file | `test_b02_every_client_metadata_field_is_refused` |
| B01-B30 全绿和单次 Codex checkpoint 前不得声明 WP-B 或 V3 PASS | this package declares **no** PASS; it stops at `WP-B FINAL CORRECTIVE AWAITING CODEX CHECKPOINT`, and B29/B30 are reported as an external-input block | `04-b01-b30-case-table.md` |

## Anti-false-green review

| risk | how this package avoids it |
|---|---|
| a test that repeats the implementation's own value | the Extension test reads the schema version out of the **shipped contract file**; the Runtime test reads the header set out of the **shipped client source** and compares it with what the Runtime requires |
| a case label counted as a pass | `04-b01-b30-case-table.md` maps every case to a **named test**; a label with no test is reported as missing |
| HTTP 200 counted as success | B21 requires real SenseVoice text; B22 requires a served PNG thumbnail, the four projections, two durable receipts and zero residuals |
| a stubbed transcript or a stubbed frame | the B21 transcript comes from the real local SenseVoice model on the authorized real media; the B22 frames come from the real ffmpeg on the real bytes |
| a private method called instead of the product route | B22 drives the authenticated `materialize-visual` route and reads the thumbnail over the production evidence route |
| a unit pass counted as a production pass | the hard-kill probe is a real `os._exit(137)` across a process boundary, and the recovery is a genuinely new process |
| a failure that leaves residue | every failure path asserts the negative state: no writer, no session, no token, no residual artifact, no published success |

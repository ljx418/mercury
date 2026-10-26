# The exact preflight and Provider-lock negative matrix

Every case below is a `node:test` case in
`scripts/stage_b_b5_3/test/gc_b5r_preflight.node-test.mjs` and runs in the ONE
offline command (`node scripts/stage_b_b5_3/test/run_offline_suite.mjs`).

## 1. The preflight's declared-asset matching (C2)

| # | Negative | Expected receipt state | Case |
|---|---|---|---|
| 1 | the exact frozen identity `portal:bilibili:<frozen BVID>:<unit>:<part>` | `localAssetAvailable = true`, `localAssetIneligibleReason = null` | `C2: the exact frozen identity is eligible` |
| 2 | a **foreign BVID** in the identity | `localAssetAvailable = false`, reason `identity_foreign_bvid` | `C2: a FOREIGN BVID identity is refused` |
| 3 | a **wrong adapter** | `localAssetAvailable = false`, reason `identity_foreign_portal` | `C2: a wrong portal or adapter is refused` |
| 4 | a **wrong portal** (not `portal:`) | `localAssetAvailable = false`, reason `identity_malformed` | `C2: a wrong portal or adapter is refused` |
| 5 | an **empty playback unit** | `localAssetAvailable = false`, reason `identity_empty_unit` | `C2: an empty playback unit or part is refused` |
| 6 | an **empty part** | `localAssetAvailable = false`, reason `identity_empty_part` | `C2: an empty playback unit or part is refused` |
| 7 | a **missing identity** | `localAssetAvailable = false`, reason `identity_missing` | `C2: a missing or malformed identity is refused` |
| 8 | a **malformed identity** (too few components) | `localAssetAvailable = false`, reason `identity_malformed` | `C2: a missing or malformed identity is refused` |
| 9 | a **declared media id** that is not the frozen BVID | `localAssetAvailable = false`, reason `media_id_mismatch` | `C2: a declared media id that is not the frozen BVID is refused` |
| 10 | a **symlinked** path | `localAssetAvailable = false`, reason `path_is_a_symlink` | `C2: a symlinked, missing or non-regular path is refused` |
| 11 | a **missing** path | `localAssetAvailable = false`, reason `path_missing` | `C2: a symlinked, missing or non-regular path is refused` |
| 12 | a **directory** instead of a file | `localAssetAvailable = false`, reason `path_not_a_regular_file` | `C2: a symlinked, missing or non-regular path is refused` |
| 13 | a **wrong identity** on a real file | `localAssetConfigured = true`, `localAssetAvailable = false`, `localAssetByteLength = null` | `C2: a WRONG identity never yields an available asset` |
| 14 | a **duplicated path** across two frozen sources | both sources ineligible, reason `path_declared_for_another_source`; the duplicates are listed at the receipt level | `C2: an unknown manifest key and a duplicated path stay visible` |
| 15 | an **unknown manifest key** | the key is listed in `localAssetManifestUnknownKeys` and never becomes a source | `C2: an unknown manifest key and a duplicated path stay visible` |
| 16 | an **undeclared** asset | `localAssetConfigured = false`, `localAssetAvailable = false`, reason `not_declared`; nothing is searched for | `C2: an undeclared asset is absent, never searched for` |
| 17 | a **missing manifest file** | a refusal, not a silent empty plan | `C2: a missing declared manifest is a refusal, not a silent empty plan` |

**A wrong identity never yields `localAssetAvailable = true` and never yields
any equivalent matching/eligible signal.** The ineligible reason is a stable
token, never a path, a digest or any other secret.

The preflight reads **no file content**, computes **no digest**, touches **no
cookie** and searches **no directory**: the availability probe is `lstat` plus
the regular-file check.

## 2. The exact Provider lock (C3)

Two facts, each in its own field, both matched exactly:

| Field | Frozen value |
|---|---|
| `providerId` (the selected PRODUCT Provider) | `minimax-cn-openai-vision` |
| `endpointClass` (the endpoint/adapter class) | `minimax_chat_completions` |

| # | Negative | Expected | Case |
|---|---|---|---|
| 1 | the exact locked receipt | no offender | `C3/O05: the exact locked receipt is accepted` |
| 2 | a **missing** `providerId` | offender `providerId=missing` | `C3/O05: a MISSING Provider id is a refusal` |
| 3 | a **missing** receipt | offender `receipt=missing` | `C3/O05: a MISSING Provider id is a refusal` |
| 4 | the lookalike `attacker-minimax-shadow` | offender `providerId=…` | `C3/O05: a LOOKALIKE Provider id is a refusal` |
| 5 | the lookalike `minimax` | offender `providerId=…` | `C3/O05: a LOOKALIKE Provider id is a refusal` |
| 6 | the lookalike `minimax-cn-openai` | offender `providerId=…` | `C3/O05: a LOOKALIKE Provider id is a refusal` |
| 7 | the lookalike `minimax-cn-openai-vision-2` | offender `providerId=…` | `C3/O05: a LOOKALIKE Provider id is a refusal` |
| 8 | the lookalike `MINIMAX-CN-OPENAI-VISION` (case) | offender `providerId=…` | `C3/O05: a LOOKALIKE Provider id is a refusal` |
| 9 | the endpoint class in the Provider field (`minimax_chat_completions`) | offender `providerId=…` — the two concepts are never interchangeable | `C3/O05: a LOOKALIKE Provider id is a refusal` |
| 10 | a **wrong endpoint class** | offender `endpointClass=…` | `C3/O05: a WRONG endpoint class is a refusal` |
| 11 | a **missing** `endpointClass` | offender `endpointClass=missing` | `C3/O05: a WRONG endpoint class is a refusal` |
| 12 | **DeepSeek** (`deepseek-chat` + its endpoint class) | two offenders | `C3/O05: DeepSeek is a refusal` |
| 13 | **two** declared provider authorities | offender `providers=2` | `C3/O05: TWO declared provider authorities are a refusal` |
| 14 | a **bounded retry** by the same Provider (`requestCount = 2`) | no offender — a retry is not a second Provider | `C3/O05: a bounded retry by the SAME Provider is not a second Provider` |

The **one Provider** proof itself is the production composition, not a
synthetic array: the Runtime's synthesis factory is invoked exactly once per
task (asserted by the Python case
`test_o05_exactly_one_provider_is_asked_per_task`, which counts the factory
invocations) and exactly one authoritative receipt is published. The runner
records the selected id, the endpoint class and the OBSERVED values in
`receipt.json`, `isolation.json` and `provider_lock.txt`, so the evidence
carries both facts and what was actually observed.

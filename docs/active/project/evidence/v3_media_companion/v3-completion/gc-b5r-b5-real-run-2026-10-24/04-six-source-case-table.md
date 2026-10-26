# The six-source case table

The fixed denominator, in the registry's exact order. The registry digest was
verified before the run: `9c2da2f4c4c16fc94e1e0d7dfc9362ab1177d2db53f63d4af5a81a44795c9454`.

| Order | BVID | Disposition | Route | Task id | Rev | Source identity | Provider / endpoint | Upload counters | Derivative SHA-256 | The frozen refusal |
|---:|---|---|---|---|---:|---|---|---|---|---|
| 1 | `BV11t8w6oEtP` | **complete** | automatic_credentialed_acquisition | `media_task_2008e36845fe4aa494907b70b98a9272` | 7 | `portal:bilibili:BV11t8w6oEtP:41095398520:p1` | `minimax-cn-openai-vision` / `minimax_chat_completions` | all six **0** | `41784bc3d05bb91191257f760f053f064b07dbf1cc7968993326ae4ce905fc0b` | — |
| 2 | `BV1QcYx6VEAj` | **complete** | automatic_credentialed_acquisition | `media_task_30fcf70fff764b3aa4a3eaad5ec21f5f` | 7 | `portal:bilibili:BV1QcYx6VEAj:41727364600:p1` | `minimax-cn-openai-vision` / `minimax_chat_completions` | all six **0** | `7c47ce6a9bbebe550be2f8f8e4c0ed280a54d9fdf3eb3536c08490ca84bc7922` | — |
| 3 | `BV1v58B6GEan` | **failed** | automatic_credentialed_acquisition | `media_task_9dbe595e374445f89450fbce6a82b8ac` | 7 | `portal:bilibili:BV1v58B6GEan:41136295066:p1` | none (no synthesis was published) | all six **0** | none published | `V3510B_CHAPTER_TIME_INVALID` — "Chapter starts must strictly increase." |
| 4 | `BV1M5tJ6kEvw` | **failed** | automatic_credentialed_acquisition | `media_task_35e344c7f3a14ac2b83b6aeed7c11782` | 7 | `portal:bilibili:BV1M5tJ6kEvw:41521119805:p1` | none (no synthesis was published) | all six **0** | none published | `V3510B_PROVIDER_RESPONSE_INVALID` — "Chapter count is invalid." |
| 5 | `BV1HTbi6LERi` | **failed** | automatic_credentialed_acquisition | `media_task_ba06e17e68ee4869a127907a9d583f8e` | 7 | `portal:bilibili:BV1HTbi6LERi:41002929285:p1` | none (no synthesis was published) | all six **0** | none published | `V3510B_PROVIDER_RESPONSE_INVALID` — "Chapter fields are invalid." |
| 6 | `BV1qM9fB8Eb2` | **complete** | automatic_credentialed_acquisition | `media_task_f678231396144e13b06f9f1410006b9c` | 7 | `portal:bilibili:BV1qM9fB8Eb2:38063116031:p1` | `minimax-cn-openai-vision` / `minimax_chat_completions` | all six **0** | `568c5462ac9d90c8ae13e7727e39ff63a7182de064f68d2bb98e1274bc87989b` | — |

**Aggregate:** `complete 3 · limited 0 · blocked 0 · failed 3` — the machine-positive
candidate needs `complete >= 5` and `failed = 0`, so the verdict is not positive and
the sequencer exited **1**.

The task identities of the three refused sources come from the sequencer's console
log (their machine receipt is written by the failure path, which reports the
refusal rather than the identity). The dependency generation is the same content-
addressed generation on every source (`depgen_edc19bc7…f1a872c`): the same frozen
dependency set, a fresh lease per source.

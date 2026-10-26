# Stage B multi-provider structured-output assessment

Date: 2026-10-14. Scope: V3-5.10 Stage B grounded text synthesis only.
Decision: **the current MiniMax-only provider contract is not sufficient for the
remaining Stage B work. Multi-provider support is feasible, but implementation
requires a new contract freeze and explicit authorization. B-5 remains stopped.**

## 1. Question and conclusion

The immediate failure looked like malformed provider JSON, but treating strict
JSON as the complete fix would be incorrect. Provider output has four separate
reliability layers:

1. **Transport:** authentication, quota, rate limits, timeout and regional
   availability.
2. **Syntax and shape:** valid JSON and conformance to the requested schema.
3. **Semantic contract:** evidence IDs exist, timestamps are ordered, cardinality
   is valid, chapters cover the video and claims are supported.
4. **Publication authority:** the result belongs to the current task/revision,
   was produced by one declared attempt and replaces no newer accepted result.

Provider-side strict schema mainly strengthens layer 2. Navia must continue to
own layers 3 and 4. Consequently, no provider is allowed to publish directly and
no provider's "strict" label constitutes Stage B acceptance.

## 2. Current implementation gap

The repository already has useful primitives:

- `provider_settings.py` persists secrets through OS keyring or Windows
  Credential Vault and exposes masked metadata.
- The vision catalog defines `openai_responses` and
  `minimax_chat_completions` adapters.
- Stage B has a canonical result schema, semantic validation, bounded repair,
  task/revision guards and atomic publication behavior.

The remaining coupling is material:

- `app.py:create_grounded_media_synthesis_provider()` accepts only
  `MINIMAX_ADAPTER_KIND`; OpenAI's catalog entry cannot currently serve grounded
  text synthesis.
- A setting named for a visual provider implicitly selects the Stage B text
  structuring provider, although those roles have different data, model and
  privacy requirements.
- Capability is inferred from adapter kind. It is not bound to endpoint, model,
  structure mode or schema hash.
- There is no qualified fallback policy or receipt that proves why a fallback
  ran and which single attempt became authoritative.

This is enough for a single-provider prototype, not for stable later development.

## 3. Provider capability comparison

| Provider path | Structure mechanism | What it can prove | Known limitation / current evidence | Stage B status |
|---|---|---|---|---|
| MiniMax current adapter | Prompt-constrained JSON through Chat Completions | A model may return the requested object | Current real runs produced malformed output and a repaired object with invalid claim cardinality. No frozen provider-side strict schema mechanism is wired. | Existing visual/text provider; not acceptable as sole structural authority for B-5 |
| DeepSeek Chat | `response_format: json_object` | Valid JSON syntax when a non-empty response is returned | Official guidance warns JSON mode may occasionally return empty content; semantic correctness remains application-owned. Local 3/3 probe attempts returned HTTP 402 before inference. | Unqualified |
| DeepSeek beta tool call | Strict function parameters on `/beta` | Arguments constrained to the supported JSON Schema subset | Endpoint/model/schema compatibility must be qualified. Local 3/3 attempts returned HTTP 402 before inference. | Preferred DeepSeek qualification path; currently unavailable |
| DeepSeek Responses | `text.format: json_schema` | Schema-constrained response on supported models | Newer endpoint and model matrix require explicit pinning. Local 3/3 attempts returned HTTP 402 before inference. | Candidate after account recovery |
| OpenAI Responses | Strict JSON Schema structured output | Strong syntax/shape constraint using a documented schema subset | Existing Navia OpenAI adapter is vision-oriented and is not wired to Stage B synthesis; semantic validation is still required. | Strong candidate; key and qualification missing |
| Gemini | Response JSON Schema | Schema-constrained output using a supported schema subset | Official guidance states schema-valid output may still be semantically wrong. Requires a separate adapter and qualification. | Candidate |
| Qwen selected models | JSON Schema structured output for eligible text models | Strict shape on the documented model subset | Model-specific support; multimodal requests may fall back to JSON Object. Stage B uses derived text, so text-only qualification avoids that downgrade. | Practical China-region candidate |

Anthropic and other providers are deliberately not ranked in this round because
no current official capability matrix, credential and local qualification run
were frozen. They can be added through the same capability protocol later.

Official capability references used for this assessment:

- DeepSeek JSON Output:
  <https://api-docs.deepseek.com/guides/json_mode/>
- DeepSeek strict tool calls:
  <https://api-docs.deepseek.com/guides/tool_calls/>
- DeepSeek Responses API:
  <https://api-docs.deepseek.com/api/create-response/>
- OpenAI Structured Outputs:
  <https://developers.openai.com/api/docs/guides/structured-outputs>
- Gemini Structured Outputs:
  <https://ai.google.dev/gemini-api/docs/structured-output>
- Qwen Structured Output:
  <https://help.aliyun.com/en/model-studio/qwen-structured-output>

## 4. Proposed stable contract

### 4.1 Separate roles

Introduce two independently selectable roles while sharing the existing secret
store:

- `visual_evidence`: receives only the already authorized selected frames and
  emits frame observations.
- `grounded_text_synthesis`: receives the authorized derived transcript/OCR/
  observation text and emits the Stage B candidate contract.

A provider may implement either or both roles. Stage B fallback never expands
the upload scope: raw video, raw audio, Cookie, provider key and local paths
remain prohibited.

### 4.2 Canonical provider interface

The application-facing interface should be provider-neutral:

```text
GroundedSynthesisProvider.synthesize(request, contract) -> ProviderAttempt

request:
  taskId, sourceRevision, authorizationReceiptId, evidence[], coverage metadata
contract:
  schemaVersion, schemaSha256, semanticRuleVersion
attempt:
  candidate | refusal | unavailable | malformed
  providerId, model, endpointClass, structureMode, attemptId, latencyMs
  requestSha256, responseSha256, usage, finishReason
```

Adapters translate the canonical request into provider-specific Chat, Responses
or tool-call APIs. Adapters do not validate business semantics and cannot write
the published projection.

### 4.3 Capability descriptor

Every selectable provider/model/endpoint tuple must declare and verify:

```text
roles: [visual_evidence | grounded_text_synthesis]
structureMode: strict_json_schema | strict_tool | json_object | prompt_json
schemaDialect/subset
supportsRequired/maxItems/additionalProperties
maxInputTokens/maxOutputTokens
region and endpoint class
data-retention disclosure version
qualificationStatus and qualificationReceiptId
qualifiedSchemaSha256
```

`configured` means a secret exists. `reachable` means a probe succeeded.
`qualified` means the exact tuple passed the frozen contract denominator. These
states must not be conflated in Settings or Runtime routing.

### 4.4 Validation and publication

All adapters feed one invariant pipeline:

```text
provider candidate
  -> JSON/schema validation
  -> semantic/evidence validation
  -> task/revision/authorization freshness validation
  -> atomic publication
```

Strict output cannot bypass semantic validation. Schema-valid but unsupported
claims, fabricated evidence IDs, weak whole-video coverage, invalid chapter
boundaries and stale task results fail closed.

### 4.5 Fallback rules

- Use one configured primary and at most one explicitly enabled, qualified
  fallback for an invocation.
- Fallback is allowed only for frozen classes such as unavailable, timeout,
  empty, malformed or schema-invalid. Content-safety refusal and authorization
  denial do not silently route elsewhere.
- Do not merge claims, chapters or brief text from different providers.
- Do not issue parallel best-of-N requests or retain only the most favorable
  candidate; that would change cost, privacy and the acceptance denominator.
- One successful provider attempt becomes the complete candidate. It still
  passes the shared semantic validator and atomic freshness guard.
- The receipt records the primary failure class, fallback reason and the single
  authoritative attempt. Settings discloses possible extra latency, cost and
  the second provider's data handling before fallback is enabled.

## 5. DeepSeek probe

The authorized key in the desktop file was read only at runtime. The probe used
three synthetic evidence rows and attempted each mode three times:

| Mode | Result | Interpretation |
|---|---:|---|
| Chat JSON Object | 0/3, HTTP 402 | Request did not enter inference |
| Beta strict tool | 0/3, HTTP 402 | Request did not enter inference |
| Responses JSON Schema | 0/3, HTTP 402 | Request did not enter inference |

HTTP 402 indicates an account/payment availability issue, not a structural
output verdict. DeepSeek is therefore neither accepted nor rejected on quality;
it remains **unqualified** until the account can execute inference.

Evidence:

- `probe-deepseek-structured-output.py`
- `deepseek-structured-output-probe.json`

The report persists no key, response text, prompt, real Navia evidence or local
secret path. No Bilibili data, transcript, OCR, image, audio or video was sent.

## 6. Qualification denominator

A provider tuple may become selectable for Stage B only after all of the
following pass without denominator reduction:

1. Schema compatibility is checked locally for the provider's documented
   subset before network use.
2. Twenty repeated synthetic calls yield 20/20 non-empty, parseable,
   schema-valid objects; refusal and truncation are recorded separately.
3. Negative fixtures prove invalid evidence IDs, cardinality, timestamp order,
   stale revision and unsupported claims are rejected by Navia even if provider
   shape is valid.
4. An outage/malformed-output drill proves at most one qualified fallback,
   complete-result replacement, no field merging and one authority receipt.
5. The unchanged six-video fixed denominator runs under one declared routing
   policy. Failed videos cannot be removed and a provider cannot be switched
   mid-run to manufacture a pass.
6. Host-model review evaluates brief value, claim grounding, chapter coverage
   and boundary quality. Strict schema alone cannot pass this gate.
7. Secret scan, upload counters and retention disclosures remain green.

Qualification is invalidated when provider ID, model, endpoint class, structure
mode, schema hash or semantic rule version changes.

## 7. Cost and UX impact

| Area | Cost | Required control |
|---|---|---|
| Runtime adapters | One adapter and error mapping per API family | Shared canonical request/result; no provider-specific fields above adapter layer |
| Settings | Separate visual and text roles plus optional fallback | Show configured/reachable/qualified separately; disclose region, latency, cost and data scope |
| Tests | Contract matrix grows by provider tuple, not just vendor | Common fixture suite plus provider-specific transport probes |
| Operations | More rate-limit, billing and endpoint failure modes | Stable internal error taxonomy and qualification expiry |
| User cost/latency | Fallback can add a second request | Disabled by default until explicit user opt-in and disclosure |
| Privacy | A fallback may send derived text to a second vendor | Preserve the existing authorization scope and record provider routing in the receipt |

The architecture cost is moderate but bounded because schema, semantic
validation, freshness and publication remain shared. Duplicating the entire
Stage B pipeline per provider would be high cost and is prohibited.

## 8. Recommended next route

Adopt **Route 3: capability-negotiated grounded synthesis**:

1. freeze a provider-neutral contract, capability descriptor, error taxonomy,
   routing receipt and Settings disclosure;
2. split visual and grounded-text provider selection while retaining the OS
   secret store;
3. implement one strict text adapter first, chosen only after credentials can
   pass the qualification probe;
4. retain MiniMax as a visual provider and optional text candidate, not as the
   sole structural authority;
5. resume B-5 only after independent document review and explicit user
   implementation authorization.

DeepSeek is technically promising because it exposes strict tool/schema paths,
but the current HTTP 402 result blocks qualification. Enabling it immediately
would replace one unstable dependency with an untested one and would not satisfy
the Stage B gate.

## 9. Gate decision

- Route 2 local code/tests: retained, not promoted to Stage B PASS.
- B-5 fixed six-video run: **FAIL / REPLAN**.
- DeepSeek grounded synthesis: **UNQUALIFIED (HTTP 402 before inference)**.
- Multi-provider implementation: **NO-GO pending contract freeze, independent
  document audit and explicit user authorization**.
- B-6, B-7, Stage C/D and final V3: remain **NO-GO**.

## 2026-10-14 qualification update

The fixed DeepSeek tuple `deepseek-chat + /beta/chat/completions + strict tool`
subsequently passed 20/20 synthetic exact-Schema trials. DS-1..DS-5 were
implemented under the user's conditional authorization; see
`stage-b-deepseek-strict-adapter-implementation-exit-2026-10-14.md`.
This closes the adapter-structure research item but does not close B-5: real
project evidence may use DeepSeek only after the user explicitly selects the
verified provider in Settings. MiniMax remains the default and no automatic
cross-provider fallback is allowed.

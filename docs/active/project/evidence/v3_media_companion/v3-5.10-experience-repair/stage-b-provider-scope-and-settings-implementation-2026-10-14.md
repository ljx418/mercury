# Stage B provider scope and Settings implementation

Date: 2026-10-14. Scope: provider selection policy and Settings behavior only.

## Decision

- MiniMax remains the V3 media development and Stage B production primary.
- DeepSeek is qualified only as a structured-output research candidate. It does
  not become active when its credential is saved.
- A user must explicitly select a saved non-default provider in `Chat Provider`
  and save that selection before Runtime uses it for Chat.
- The empty first-use form is provider-neutral. It does not prefill or recommend
  DeepSeek, MiniMax or another vendor.
- This change does not wire DeepSeek into Stage B grounded synthesis and does not
  authorize B-5 to resume.

## Post-recharge qualification

The synthetic probe was repeated after account recharge. No real video,
transcript, OCR, image, audio, Cookie or local path was uploaded.

| DeepSeek mode | Result | Scope decision |
|---|---:|---|
| Chat JSON Object | 0/3 schema-valid; HTTP 200 | Not a valid Navia contract mode |
| Beta strict tool | 3/3 schema-valid; HTTP 200 | Research-qualified candidate |
| Responses JSON Schema | 3/3 schema-valid; HTTP 200 | Research-qualified candidate |

Evidence: `deepseek-structured-output-probe-post-recharge-2026-10-14.json`.
This is a three-trial synthetic capability result, not the 20/20 provider
qualification or six-video Stage B acceptance denominator.

## Implemented behavior

1. Runtime accepts controlled `minimax` and `deepseek` Chat provider types.
2. Saving DeepSeek only adds it to the provider list. It does not modify
   `defaultProviderId`, profiles or the current Chat route.
3. Saving MiniMax may initialize the default only when no default exists.
4. Settings first displays a neutral `请选择服务商` option.
5. Saving any provider explicitly states that no switch occurred.
6. The existing Chat Provider selector remains the only activation action.
7. Provider diagnostics no longer describe all authentication/configuration
   failures as DeepSeek-specific.

## Verification

- Backend provider/settings/chat selection: 16 passed.
- Frontend provider-selection tests: 5 passed.
- TypeScript typecheck: passed.
- DeepSeek synthetic probe: strict tool 3/3; Responses schema 3/3; JSON Object
  0/3.
- Secret scan of probe artifacts: no key persisted; report explicitly records
  `secretMaterialPersisted=false` and `realProjectEvidenceUploaded=false`.
- No Chrome or audio was used.

## Remaining boundary

The legacy Chat provider table still carries pre-existing local-only credential
storage debt. The desktop DeepSeek key was used for the isolated probe but was
not silently imported into product Settings. Persisting it must use the normal
user-visible Settings action or a separately audited migration to the existing
OS credential store.

DeepSeek Stage B use remains NO-GO until the provider-neutral synthesis contract,
strict-mode adapter, 20/20 qualification, shared semantic validator and explicit
manual selection are implemented and independently reviewed.

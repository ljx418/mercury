# Stage B B-5 provider-contract risk stop

Date: 2026-10-13. Decision: **B-5 FAIL / REPLAN; B-6 and B-7 NO-GO**.

## Stop reason

The first fixed accessible denominator video, `BV1pohR6rEEh`, completed fresh
task creation and reached grounded synthesis, but MiniMax-M3 did not produce a
candidate satisfying the frozen V2 contract. The validator failed closed and
the Runtime returned HTTP 502. No V2 derivative was published or substituted.

The final two product attempts both ended with:

`V3510B_BRIEF_LENGTH_INVALID` / `Brief must contain 20-100 Unicode characters.`

The second attempt already included one provider-side full-contract regeneration
with the rejected candidate, machine failure code, 40-80 character recommendation,
2-8 claim rule and frozen first/last evidence IDs. The model still returned a
brief below the minimum. Local concatenation, padding, threshold reduction and
promotion of chunk summaries were deliberately not used.

## Attempts

All Chrome launches included `--mute-audio`; each attempt used a new temporary
profile, Runtime, database and task namespace. Temporary private media and frame
artifacts were deleted at process exit.

| Evidence | SHA-256 | Classification |
|---|---|---|
| `stage-b-real-runs/20261013T140624050Z-stage-a-failure.json` | `52ea97933ea031eb03bbf36d17301309b4f393b6accf9d760a7af38cca3750c1` | harness: copied DB attached an old authority; fixed by clearing temporary media run tables |
| `stage-b-real-runs/20261013T141441524Z-stage-a-failure.json` | `5519ccf9bafac0c826db3ddcbc01640b337e03dc68df39590bf2df1138af6a29` | harness: dialog-only timeout lacked alert diagnosis |
| `stage-b-real-runs/20261013T141846725Z-stage-a-failure.json` | `f259a2c0379ade420fddbf89089d18d0b20932e54db36ea7fe7b1799a7382cb0` | harness: one transient blank screenshot; fixed with bounded recapture and unchanged pixel threshold |
| `stage-b-real-runs/20261013T143354317Z-stage-a-failure.json` | `1194f5574e500288ebd17f15150f51ff9a6dee03e4f0f73499421f1516e66933` | product/provider: first chapter omitted earliest evidence; rejected |
| `stage-b-real-runs/20261013T143851663Z-stage-a-failure.json` | `5c12afa9ec80c892948804ae5b4cc7dff43aa0e77797e206c43af14e7a76cd13` | product/provider: regenerated brief below 20 characters; rejected |
| `stage-b-real-runs/20261013T144443909Z-stage-a-failure.json` | `c2e8331dabf77942c6ff5a27c11475a8662fda089a01e9adba237ec6753a2b34` | product/provider: full-contract regeneration still below 20 characters; rejected |

## Gate impact

- B-1..B-4: LIMITED PASS candidate only.
- B-5 six-video denominator: FAIL on video 1/6; remaining five intentionally not run.
- B-6 host semantic review and sentinel repeat: NO-GO because no positive V2
  derivative exists.
- B-7 independent implementation exit audit: NO-GO; an audit cannot convert a
  failed real denominator into PASS.
- Stage C/D and final V3: remain blocked by this Stage B gate.

## Replan options

1. **Recommended: schema-constrained provider route.** Use a provider/model API
   with native JSON Schema or tool-call constrained decoding for Stage B. Keep
   MiniMax as a content proposer but require the constrained provider to emit
   the contract. Highest reliability; adds provider/configuration cost.
2. **Deterministic local brief composer.** Compose a 20-100 character brief from
   already validated claims using a frozen algorithm. Lowest runtime cost, but
   changes the architecture and requires a new contract/audit because local
   composition may reduce fluency and semantic nuance.
3. **MiniMax prompt iteration.** Add examples and further retries. Lowest
   architecture cost but current repeated evidence shows weak reliability,
   higher latency/cost and a material risk of another field regressing.

Option 3 is not approved automatically because repeated retries already failed
and would weaken predictable user latency. Options 1 or 2 require a document
replan and explicit authorization before resuming B-5.


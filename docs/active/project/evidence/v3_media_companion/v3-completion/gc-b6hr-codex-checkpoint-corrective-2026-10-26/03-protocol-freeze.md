# Canonical Review Protocol Freeze

Codex reviewed and first froze the canonical Provider-blind host review protocol on 2026-10-26.

```text
rubric path: scripts/stage_b_b5_3/protocol/review-rubric.v1.md
rubric bytes: 3838
rubric sha256: 60a32cd9a9334a702a6b588ae864194426c82c7130d43cd2f979748e1255f5de

prompt path: scripts/stage_b_b5_3/protocol/review-prompt.v1.md
prompt bytes: 5353
prompt sha256: 6c1f53f2aab1981937aa0f97f8c95a9102ed0ff763e30212bc65ae89826e87d2
```

The protocol is loaded only from these repository-relative paths. The precommit binds run id, immutable registry order, randomly drawn presentation order, two distinct review sessions, order-3 sentinel, and two different sentinel positions. A caller-supplied replacement, byte drift, count drift, reordered pass, reused session, or changed sentinel placement is rejected.

The implementation session must not score its own candidate. If the machine gate is positive, it produces blind projections and hands them to an independent host evaluator. The evaluator may inspect only those projections and returns contract-shaped rows; the production aggregate validates the rows and repeated sentinel.


# Relay v11 preimplementation audit manifest

Date: 2026-10-18

Status: `DOCUMENT PASS / IMPLEMENTATION NO-GO PENDING EXPLICIT AUTHORIZATION`

Purpose: correct the relay v10 sender-policy assumption disproved by the real Chrome run
`r5b-positive-20261018T194000Z`, without rewriting v10 history or weakening sender validation.

Authority order:

1. approved V3 PRD and capture ownership architecture;
2. accepted R0-R4 implementation checkpoints;
3. Window 11 real failure evidence and threat model;
4. this package after its verifier and mutation verifier pass;
5. a future explicit user authorization for relay v11 implementation.

This package does not authorize code changes, visible Chrome, R6 implementation, R7 or P1.

Verify from this directory:

```bash
sha256sum -c AUDIT_MANIFEST.sha256
python3 -B 05-verify-document-package.py
python3 -B 06-verify-document-mutations.py
```

Package size: 10 files including this manifest and its SHA-256 companion. Product implementation is not part of
this package. Read this manifest, then `01` through `03`, matrix/verifiers, audit and execution prompt.

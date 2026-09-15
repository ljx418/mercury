# External ChatGPT Audit Package Process

## Fixed Staging Directory

Every external ChatGPT document audit uses one temporary staging directory:

```text
docs/active/project/external-audit-package/
```

The authoritative source files remain in their original `docs/active` locations. The staging directory contains copies prepared only for the current audit.

## Required Sequence

1. Before preparing an audit, remove every file and subdirectory left in `external-audit-package/`.
2. Copy only the current round's Markdown, Drawio, JSON Schema, fixture and prototype-review files into the staging directory.
3. Keep every staged file directly under `external-audit-package/`; subdirectories are forbidden. Use ordered, unambiguous filenames so same-name source files cannot overwrite one another.
4. Select only the highest-priority documents needed for the current decision. The directory may contain at most 20 files total, including `AUDIT_MANIFEST.md`.
5. Generate `AUDIT_MANIFEST.md`. Record each authoritative source path, staged filename, SHA-256, audit purpose and the reason lower-priority files were omitted.
6. Validate that every manifest entry exists, its SHA-256 matches and the directory has no subdirectory before presenting it to ChatGPT.
7. List ChatGPT audit paths from the staging directory only. Do not ask the reviewer to assemble files from scattered repository paths.
8. After receiving the review, revise the authoritative source files first. Do not treat staged copies as authoritative documents.
9. Before the next audit round, clear the staging directory again and build a fresh package. Never retain prior-round reports, fixtures or superseded documents in the new package.

## Gate Rule

An audit package is invalid when it contains stale files from an earlier round, contains any subdirectory, omits a manifest-listed file, has a hash mismatch, contains more than 20 files total, or mixes `docs/history` into an active review without an explicit historical-trace request.

The package directory is transport-only evidence. Its existence does not change a stage gate, approve implementation or replace the authoritative documents under `docs/active`.

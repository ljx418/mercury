# Root Cause

## Primary defect

`prepare_candidate.mjs` correctly executes the copied Runtime, Extension and harness bytes from a sealed snapshot. `candidateEnvironment()` passes the snapshot root, original tool root and durable repository root, but it does not materialize the product dependency settings that `resolveOwnedProductPaths()` normally derives from its module-local repository root.

Inside the snapshot child, that module-local root is the snapshot. Its default vision Provider database therefore points below the snapshot, where private product state is intentionally absent. The production preflight ran from the worktree and validated the original product database. Both checks were individually consistent but did not validate the same effective child environment.

## Secondary defects

1. The missing-database condition was reduced to generic `Error` in the machine receipt even though the console held a stable external-input diagnosis.
2. `collectArtifactDigests()` returns duplicate SHA-256 entries for byte-identical files. Public retention rejects duplicates, so the first closeout publication was refused before writing. The private closeout used a set of owner-produced digests and then passed the unchanged sealed publisher. This did not change the six machine rows.

## Required invariant

The preflight and each snapshot child must consume one immutable dependency-resolution object. The object binds managed tools, ASR root, vision Provider source database, extension root and their non-secret identities. A missing or drifted dependency must stop before authorization consumption, Cookie read, Chrome launch, Runtime startup, or source attempt.


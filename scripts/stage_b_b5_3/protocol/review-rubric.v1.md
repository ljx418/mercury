# GC-B6 Blind Semantic Review Rubric — CANONICAL v1

This file is the CANONICAL rubric of the GC-B6 blind semantic review. It is
repository-tracked, versioned and byte-frozen: the harness loads THIS file and
never a caller-supplied replacement.

These exact bytes were first frozen by the Codex GC-B6H-R checkpoint on
2026-10-26. The previous private rubric bytes cannot be inferred from a hash
and are not claimed to be restored here.

## 1. The input

The evaluator may read ONLY the `blind_projection` of a private review
bundle. The evaluator may NOT read: the Provider identity (the provider id,
the model id, the endpoint class, the attempt), the Provider receipt text, any
runtime path, database reference or profile reference, any raw media, a
Cookie, a key, a bearer, the run path, the registry position of the source
under review, or any metadata outside the blind projection.

The blind projection carries: the source order and bvid, the irreversible
review binding, the derivative brief, the material claims, the chapters, the
regions, the derived evidence records (id, kind, timestamps, content digest,
text), the PNG thumbnails and the seek map.

## 2. The four axes (each 1..5, each must be >= 4)

### 2.1 事实与证据准确性 (factual and evidential accuracy)

The brief, the material claims and the chapter theses are DIRECTLY
supported by the cited derived evidence; the screenshots match the claims;
the seek time reaches the corresponding time window of the claim.

### 2.2 全片覆盖 (whole-video coverage)

The opening, the middle and the ending are each SUBSTANTIVELY covered; a
long video is not compressed into an opening-only summary; cross-chapter
evidence is not used to fake coverage.

### 2.3 内容价值与适配 (content value and fit)

The brief is relevant and summarizes instead of copying; the claims are
discriminated (not a restatement of each other); the output refuses to
over-assert when the evidence is insufficient; the output is of real value
for companion reading.

### 2.4 章节边界质量 (chapter boundary quality)

The boundaries correspond to real topic changes, the order is monotonic,
the titles and the theses are accurate, the chapters are neither
excessively fragmented nor imbalanced, and the previous/next relation is
sensible.

## 3. The score anchors

- 5 = no substantive problem.
- 4 = a minor defect that does not change the understanding.
- 3 = at least one clear omission or a needed correction.
- 2 = several severe defects.
- 1 = unusable or misleading.

Any score of 3 or below FAILS. The four axes are judged individually: no
averaging may compensate a weak axis.

## 4. The critical errors (any one is a Major and cannot be offset)

- a material fact contradiction;
- a claim whose cited evidence does not support it, or supports the opposite;
- a screenshot or a seek that points at the wrong content or at the wrong
  source;
- only the opening covered, or the conclusive ending omitted;
- an unlabelled evidence conflict, or a reversal of a person, a number or a
  causality;
- a cross-task, cross-source or cross-run splice;
- a leak of raw media, a secret or a private path.

## 5. The material-claim verdicts

Every material claim carries exactly one verdict from the frozen vocabulary:
`supported`, `partially_supported`, `unsupported`.

## 6. The thesis verdict

The whole source carries exactly one thesis verdict from the same frozen
vocabulary.

## 7. The sentinel

The sentinel is the FROZEN registry order 3. It is reviewed TWICE: once in
the first review session at its committed position, and once in a SECOND
review session at a DIFFERENT committed position. A reversed thesis verdict,
a reversed material-claim verdict, a changed material-claim set, a reused
session or an axis drift greater than 1 FAILS. The two scores are never
averaged.

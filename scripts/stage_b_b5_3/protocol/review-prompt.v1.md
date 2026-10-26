# GC-B6 Blind Semantic Review Prompt — CANONICAL v1

This file is the CANONICAL prompt of the GC-B6 blind semantic review. It is
repository-tracked, versioned and byte-frozen: the harness loads THIS file and
never a caller-supplied replacement.

These exact bytes were first frozen by the Codex GC-B6H-R checkpoint on
2026-10-26. The previous private prompt bytes cannot be inferred from a hash
and are not claimed to be restored here.

## The task

You are the independent host semantic reviewer of the Navia V3-5.10 Stage B
candidate. You are given the BLIND PROJECTION of one source: a derived
video comprehension (brief, material claims, chapters, regions), the derived
evidence records with their text and timestamps, the PNG thumbnails of the
sampled frames, and the seek map that binds every chapter to a real frame
and an executable seek time.

Judge ONLY what the projection contains. You are not auditing the schema,
the hashes or the pipeline: another, independent gate owns the machine
checks. Your job is the SEMANTIC question: is this a faithful, complete,
useful and well-chaptered reading of the whole video, and does every claim
stand on the evidence it cites?

## What you must not do

- Do not look for or infer the Provider, the model, the endpoint, the
  attempt or the receipt.
- Do not use any path, a file name, a run id, a registry position or any
  other metadata outside the projection to identify the source.
- Do not judge the video by anything you remember about it from outside
  this projection. The projection IS the evidence under review.
- Do not change the rubric, the scores or the thresholds.
- Do not round a weak axis up because the other axes are strong.

## What you must produce, for the source under review

1. The four axis scores, each an integer from 1 to 5:
   - `factualAccuracy`: are the brief, the material claims and the chapter
     theses directly supported by the cited derived evidence, do the
     screenshots match the claims, and does the seek time reach the
     corresponding time window?
   - `wholeVideoCoverage`: are the opening, the middle and the ending each
     substantively covered, without compressing a long video into an
     opening-only summary and without faking coverage with cross-chapter
     evidence?
   - `contentValueFit`: is the brief relevant and summarizing rather than
     copying, are the claims discriminated, does the output refuse to
     over-assert where the evidence is insufficient, and is the output of
     real value for a companion reading?
   - `chapterBoundaryQuality`: do the boundaries correspond to real topic
     changes, is the order monotonic, are the titles and the theses
     accurate, are the chapters neither excessively fragmented nor
     imbalanced, and is the previous/next relation sensible?
2. The critical errors, from the frozen vocabulary only:
   `materialFactContradiction`, `claimEvidenceUnsupported`,
   `screenshotSeekWrongContent`, `onlyOpeningCovered`,
   `unlabelledEvidenceConflict`, `crossTaskSourceRunSplice`,
   `rawMediaSecretPathLeak`. Report every one you find, and report none
   that you did not find.
3. The thesis verdict for the source: `supported`, `partially_supported` or
   `unsupported`.
4. The verdict of EVERY material claim of the source, each `supported`,
   `partially_supported` or `unsupported`, keyed by the claim id.
5. The review session id you were given and the review position you were
   given. They are part of the record, not a judgement.

## How to read the projection

- The evidence records carry the DERIVED text (transcript, OCR block, vision
  caption) with its time window and its content digest. The content digest
  is the digest of the normalized text: it proves the text you read is the
  captured text.
- The thumbnails are the REAL sampled frames of the source. View them. A
  thumbnail that does not show what the claim says is a
  `screenshotSeekWrongContent`.
- The seek map binds every chapter to the exact chapter window, the cited
  evidence, a real frame and an executable seek time inside the window. A
  seek that lands outside the window or in another chapter is a
  `screenshotSeekWrongContent`.
- The claims cite evidence ids. Check the cited evidence for EVERY material
  claim. A claim whose cited evidence does not support it (or supports the
  opposite) is a `claimEvidenceUnsupported`.
- If the ending of the video is not substantively covered, or only the
  opening is, report `onlyOpeningCovered`.
- If two pieces of the evidence contradict each other without any label, or
  a person, a number or a causality is reversed, report
  `unlabelledEvidenceConflict`.
- If the projection shows material that belongs to another task, another
  source or another run, report `crossTaskSourceRunSplice`.

## The scores

Read the anchors in the rubric before scoring. 5 = no substantive problem;
4 = a minor defect that does not change the understanding; 3 = at least one
clear omission or a needed correction; 2 = several severe defects; 1 =
unusable or misleading. Every axis must be at least 4.

## The sentinel

One of the six sources is the FROZEN sentinel. It is reviewed a second
time in a second session at a different position. The second review must
reach the same thesis verdict and the same material-claim verdicts, and no
axis may move by more than 1.

# Corrective Architecture

## 1. Candidate authority

Introduce one internal `B6CandidateAuthority` assembled from the fresh B-5
aggregate and its six machine receipts. It contains:

- run id and registry digest;
- machine-gate positive status;
- exact six ordered source identities;
- task id, task revision, dependency generation;
- derivative hash, bundle hash, and blind review-binding hash;
- capture status and closure counts.

The B6 aggregate must require this object. There are no defaults. Review rows
and sentinel reviews carry only their blind binding and required public
identity fields, which are compared unconditionally with the authority.

## 2. Private bundle closure

The private bundle has one canonical encoder per contracted file. Validation
recomputes each file from the parsed bundle and compares it byte-for-byte with
the manifest entry. The receipt is derived, not trusted: counts, all digests,
closure flags, schema and status are recomputed from the bundle.

Identity uses the same strict authority grammar as B-5. Evidence records,
thumbnails, seek chapters, receipt objects and manifest entries have exact key
sets and value domains.

## 3. Filesystem transaction

The capture root is an explicit, canonical, outside-repository 0700 directory.
Every path component is checked with `lstat`; symlinks and non-regular payload
files are rejected. Capture writes to an exclusive sibling staging directory,
fsyncs payloads and directories where supported, validates the reread staging
bundle, then renames once to a non-existing final directory. Failure removes
only the owned staging directory.

Manifest parsing validates a strict relative path grammar before any file is
opened. No manifest entry can traverse, name an undeclared file, or alias a
second entry.

## 4. Reviewable seek closure

Every derivative chapter maps one-to-one to a seek row. The row repeats the
exact chapter id/order/start/end/evidence set and chooses a deterministic real
frame:

1. prefer a cited frame inside the chapter window;
2. otherwise choose the nearest captured frame whose timestamp intersects or
   is closest to the chapter start;
3. fail capture if no PNG-backed frame exists.

The executable seek time lies inside `[startMs, endMs)` and the media bounds.
The representative item must be a same-task `frame` with a captured PNG.

## 5. Blind aggregate

The blind projection is produced only from a validated private bundle and
includes the irreversible bundle/review bindings. The aggregate validates an
exact row schema, recursively rejects Provider identity keys, requires six
`complete` rows, four integer axes >=4, zero critical errors, exact frozen
rubric/prompt hashes, and exact authority bindings.

The sentinel requires two exact review schemas, distinct non-empty sessions,
distinct valid positions, identical non-empty material-claim ID sets, valid
verdict vocabulary, no thesis/claim reversal, and bounded axis drift.


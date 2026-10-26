// Contract tests for lib/task_id.mjs. No network, no Chrome, no Runtime.

import test from "node:test";
import assert from "node:assert/strict";
import {
  extractMediaTaskId,
  TASK_ID_FAIL,
  TaskIdError,
} from "../lib/task_id.mjs";

const VALID = "media_task_80abf0eccd58491e96610b1da5fe3567";

test("extractMediaTaskId: camelCase taskId only", () => {
  const id = extractMediaTaskId({
    status: 201,
    body: { data: { task: { taskId: VALID } } },
  });
  assert.equal(id, VALID);
});

test("extractMediaTaskId: snake_case task_id only (legacy)", () => {
  const id = extractMediaTaskId({
    status: 201,
    body: { data: { task: { task_id: VALID } } },
  });
  assert.equal(id, VALID);
});

test("extractMediaTaskId: both fields present and equal → uses one (consistent)", () => {
  const id = extractMediaTaskId({
    body: { data: { task: { taskId: VALID, task_id: VALID } } },
  });
  assert.equal(id, VALID);
});

test("extractMediaTaskId: both fields present but DIFFERENT → fail-closed with CONFLICT", () => {
  assert.throws(
    () => extractMediaTaskId({
      body: { data: { task: { taskId: VALID, task_id: "media_task_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } } },
    }),
    (e) => e instanceof TaskIdError && e.code === TASK_ID_FAIL.CONFLICT,
  );
});

test("extractMediaTaskId: missing both fields → fail-closed with MISSING", () => {
  assert.throws(
    () => extractMediaTaskId({ body: { data: { task: { sourceIdentity: "x" } } } }),
    (e) => e instanceof TaskIdError && e.code === TASK_ID_FAIL.MISSING,
  );
});

test("extractMediaTaskId: missing body.data.task → fail-closed with MISSING", () => {
  assert.throws(
    () => extractMediaTaskId({ body: {} }),
    (e) => e instanceof TaskIdError && e.code === TASK_ID_FAIL.MISSING,
  );
});

test("extractMediaTaskId: value not matching format → fail-closed with INVALID", () => {
  assert.throws(
    () => extractMediaTaskId({ body: { data: { task: { taskId: "garbage" } } } }),
    (e) => e instanceof TaskIdError && e.code === TASK_ID_FAIL.INVALID,
  );
});

test("extractMediaTaskId: response is undefined → fail-closed", () => {
  assert.throws(
    () => extractMediaTaskId(undefined),
    (e) => e instanceof TaskIdError && e.code === TASK_ID_FAIL.MISSING,
  );
});
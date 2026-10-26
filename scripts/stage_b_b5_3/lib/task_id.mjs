// Shared taskId extractor for V2.1 outline-task public responses.
//
// The public V2.1 contract returns `data.task.taskId` (camelCase). The
// internal Runtime + V1 schema / SQLite table store `task_id`
// (snake_case). Callers may receive either; both must resolve to the
// same MediaTask identifier (the two are the same value, just two
// serialization conventions).
//
// Rules:
//   - Both fields present: they MUST be equal strings; otherwise fail-
//     closed (suggests a schema drift that we refuse to paper over).
//   - Only one present: use it.
//   - Neither present: fail-closed.
//   - Value MUST match `^media_task_[0-9a-f]{32}$`; otherwise fail-closed.
//
// All failures throw a typed `TaskIdError` so callers can map to fixed
// failure codes without leaking raw values.

const MEDIA_TASK_ID_PATTERN = /^media_task_[0-9a-f]{32}$/;

export class TaskIdError extends Error {
  constructor(code, extra = {}) {
    super(`task_id: ${code}`);
    this.name = "TaskIdError";
    this.code = code;
    this.extra = extra;
  }
}

export const TASK_ID_FAIL = Object.freeze({
  MISSING: "task_id/missing",
  CONFLICT: "task_id/conflict",
  INVALID: "task_id/invalid_format",
});

export function extractMediaTaskId(outlineResponse) {
  // outlineResponse shape: { status: 201, body: { data: { task: { ... } } } }
  const task = outlineResponse?.body?.data?.task;
  if (!task || typeof task !== "object") {
    throw new TaskIdError(TASK_ID_FAIL.MISSING, { reason: "data.task absent" });
  }
  const camel = typeof task.taskId === "string" ? task.taskId : null;
  const snake = typeof task.task_id === "string" ? task.task_id : null;
  let value;
  if (camel && snake) {
    if (camel !== snake) {
      throw new TaskIdError(TASK_ID_FAIL.CONFLICT, { camel, snake });
    }
    value = camel;
  } else if (camel) {
    value = camel;
  } else if (snake) {
    value = snake;
  } else {
    throw new TaskIdError(TASK_ID_FAIL.MISSING, { reason: "neither taskId nor task_id present" });
  }
  if (!MEDIA_TASK_ID_PATTERN.test(value)) {
    throw new TaskIdError(TASK_ID_FAIL.INVALID, { value });
  }
  return value;
}
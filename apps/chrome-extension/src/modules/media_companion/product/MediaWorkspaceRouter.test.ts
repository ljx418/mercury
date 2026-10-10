import { describe, expect, it } from "vitest";
import { mediaTaskPath, resolveMediaWorkspaceRoute } from "./MediaWorkspaceRouter";

const taskId = `media_task_${"1".repeat(32)}`;
const evidenceId = `mev_${"2".repeat(32)}`;

describe("MediaWorkspaceRouter", () => {
  it("returns null for Knowledge routes so the existing router remains authoritative", () => {
    expect(resolveMediaWorkspaceRoute("#/knowledge/workspaces/ws_default/sources")).toBeNull();
  });

  it.each([
    ["#/media/tasks", "task_library"],
    [`#/media/tasks/${taskId}`, "task_overview"],
    [`#/media/tasks/${taskId}/outline`, "outline"],
    [`#/media/tasks/${taskId}/timeline`, "timeline"],
    [`#/media/tasks/${taskId}/mindmap`, "mindmap"],
    [`#/media/tasks/${taskId}/ask`, "ask"],
    [`#/media/tasks/${taskId}/evidence/${evidenceId}`, "evidence"],
    [`#/media/tasks/${taskId}/export`, "export"],
  ])("resolves %s", (hash, kind) => {
    const resolution = resolveMediaWorkspaceRoute(hash);
    expect(resolution?.ok).toBe(true);
    if (resolution?.ok) expect(resolution.route.kind).toBe(kind);
  });

  it("migrates the old transcript route to one canonical overview route", () => {
    const resolution = resolveMediaWorkspaceRoute(`#/media/transcript/${taskId}`);
    expect(resolution?.ok && resolution.legacyReplacement).toBe(mediaTaskPath(taskId));
  });

  it.each([
    "#/media/tasks/not-a-task",
    `#/media/tasks/${taskId}/unknown`,
    `#/media/tasks/${taskId}/outline/extra`,
    `#/media/tasks/${taskId}/evidence/not-evidence`,
    "#/media/current",
  ])("rejects invalid media route %s", (hash) => {
    expect(resolveMediaWorkspaceRoute(hash)).toEqual({ ok: false, attemptedPath: hash.slice(1), failureCode: "INVALID_MEDIA_ROUTE" });
  });
});

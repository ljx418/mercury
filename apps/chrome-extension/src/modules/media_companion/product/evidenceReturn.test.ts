import { beforeEach, describe, expect, it } from "vitest";
import { clearEvidenceReturn, readEvidenceReturn, recordEvidenceReturn } from "./evidenceReturn";

describe("media evidence return binding", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.location.hash = "#/media/tasks/media_task_123/outline?chapter=chapter_abcdefabcdefabcd";
  });

  it("keeps the exact chapter route and trigger when the same evidence appears twice", () => {
    recordEvidenceReturn("media_task_123", "mev_123", "chapter-two-frame");
    expect(readEvidenceReturn()).toEqual({
      taskId: "media_task_123",
      evidenceId: "mev_123",
      triggerKey: "chapter-two-frame",
      returnHash: "#/media/tasks/media_task_123/outline?chapter=chapter_abcdefabcdefabcd",
    });
    clearEvidenceReturn();
    expect(readEvidenceReturn()).toBeNull();
  });

  it("rejects corrupt or unrelated stored destinations", () => {
    sessionStorage.setItem("navia.mediaEvidenceReturn.v1", "not-json");
    expect(readEvidenceReturn()).toBeNull();
    sessionStorage.setItem("navia.mediaEvidenceReturn.v1", JSON.stringify({ taskId: "media_task_123", evidenceId: "mev_123", returnHash: "https://example.com" }));
    expect(readEvidenceReturn()).toBeNull();
  });
});

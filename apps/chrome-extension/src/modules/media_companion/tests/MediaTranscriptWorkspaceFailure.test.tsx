import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaTranscriptProjection } from "../../../runtimeClient";

const failedProjection: MediaTranscriptProjection = {
  schemaVersion: "v3-media-transcript-projection/v1",
  taskId: `media_task_${"b".repeat(32)}`,
  sourceIdentity: "portal:bilibili:BV1:1:1",
  adapterId: "bilibili",
  revision: 9,
  updatedAt: "2026-10-08T10:00:00Z",
  state: "failed",
  route: "trusted_tab_capture_asr",
  progressPercent: 61,
  failureCode: "V3_MEDIA_CAPTURE_SOCKET_LOST",
  terminal: true,
  cleanupStatus: "complete",
  canCancel: false,
  canRetry: true,
  failures: [],
  segments: []
};

vi.mock("../acquisition/useMediaAcquisitionTask", () => ({
  useMediaAcquisitionTask: () => ({ projection: failedProjection, error: null, loading: false })
}));
vi.mock("../../knowledge_workspace/LocalRuntimeAccess", () => ({
  LocalRuntimeAccess: () => <div data-testid="runtime-access">本机 Runtime 安全会话</div>
}));
vi.mock("../../../runtimeClient", async (source) => ({
  ...(await source<typeof import("../../../runtimeClient")>()),
  cancelMediaTranscriptProjection: vi.fn()
}));

import { MediaTranscriptWorkspacePage } from "../acquisition/MediaTranscriptWorkspacePage";

describe("V3 transcript workspace fault surface", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("shows the same machine reason and a retry route without false completion", () => {
    act(() => root.render(<MediaTranscriptWorkspacePage taskId={failedProjection.taskId} />));
    expect(host.textContent).toContain("任务失败");
    expect(host.textContent).toContain("V3_MEDIA_CAPTURE_SOCKET_LOST");
    expect(host.textContent).toContain("trusted_tab_capture_asr");
    expect(host.textContent).toContain("返回当前视频重新分析");
    expect(host.textContent).not.toContain("转写已完成");
  });
});

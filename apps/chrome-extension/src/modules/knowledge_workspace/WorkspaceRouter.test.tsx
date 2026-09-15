import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceRouter, buildWorkspaceHash, parseWorkspaceHash } from "./WorkspaceRouter";

describe("WorkspaceRouter", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
    document.body.innerHTML = "";
  });

  it.each([
    ["source_library", undefined, "#/knowledge/sources?workspaceId=workspace_research"],
    ["source_detail", "source_runtime_01", "#/knowledge/sources/source_runtime_01?workspaceId=workspace_research"],
    ["ask", undefined, "#/knowledge/ask?workspaceId=workspace_research"],
    ["graph", undefined, "#/knowledge/graph?workspaceId=workspace_research"],
    ["permissions", undefined, "#/knowledge/settings/permissions?workspaceId=workspace_research"]
  ] as const)("round-trips %s through the canonical route", (routeIntent, sourceId, expected) => {
    const hash = buildWorkspaceHash({ routeIntent, workspaceId: "workspace_research", sourceId });
    expect(hash).toBe(expected);
    expect(parseWorkspaceHash(hash)).toEqual({
      ok: true,
      route: {
        hostStrategy: "extension_workspace_page",
        routeIntent,
        workspaceId: "workspace_research",
        sourceId,
        resolvedPath: expected
      }
    });
  });

  it.each([
    "",
    "#/knowledge/sources",
    "#/knowledge/sources?workspaceId=",
    "#/knowledge/sources?workspaceId=workspace_research&sourceId=source_1",
    "#/knowledge/sources/source_1?workspaceId=workspace_research&workspaceId=other",
    "#/knowledge/unknown?workspaceId=workspace_research",
    "#/foreign"
  ])("rejects non-canonical route %s", (hash) => {
    expect(parseWorkspaceHash(hash)).toEqual({ ok: false, errorCode: "INVALID_ROUTE", attemptedPath: hash || "(empty)" });
  });

  it("restores direct-open, push navigation and Browser Back from location", async () => {
    window.history.replaceState(null, "", "#/knowledge/graph?workspaceId=workspace_research");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          <WorkspaceRouter>
            {({ resolution, navigate }) => (
              <div>
                <output>{resolution.ok ? resolution.route.routeIntent : resolution.errorCode}</output>
                <button onClick={() => navigate({ routeIntent: "ask", workspaceId: "workspace_research" })} type="button">Ask</button>
              </div>
            )}
          </WorkspaceRouter>
        );
      });
      expect(container.querySelector("output")?.textContent).toBe("graph");

      await act(async () => {
        container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(window.location.hash).toBe("#/knowledge/ask?workspaceId=workspace_research");
      expect(container.querySelector("output")?.textContent).toBe("ask");

      await act(async () => {
        window.history.back();
        await new Promise((resolve) => window.setTimeout(resolve, 20));
      });
      expect(window.location.hash).toBe("#/knowledge/graph?workspaceId=workspace_research");
      expect(container.querySelector("output")?.textContent).toBe("graph");
    } finally {
      root.unmount();
    }
  });

  it("recovers an invalid route to Source Library without inventing a source", async () => {
    window.history.replaceState(null, "", "#/foreign");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          <WorkspaceRouter fallbackWorkspaceId="workspace_research">
            {({ resolution, recoverToLibrary }) => (
              <button onClick={() => recoverToLibrary()} type="button">
                {resolution.ok ? resolution.route.routeIntent : resolution.errorCode}
              </button>
            )}
          </WorkspaceRouter>
        );
      });
      expect(container.querySelector("button")?.textContent).toBe("INVALID_ROUTE");
      await act(async () => {
        container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(window.location.hash).toBe("#/knowledge/sources?workspaceId=workspace_research");
      expect(container.querySelector("button")?.textContent).toBe("source_library");
    } finally {
      root.unmount();
    }
  });
});

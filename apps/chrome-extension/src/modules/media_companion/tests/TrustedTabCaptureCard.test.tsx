import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrustedTabCaptureCard } from "../capture";

const failures = [
  { route: "credentialed_subtitle" as const, failureCode: "V3_MEDIA_SUBTITLE_UNAVAILABLE" },
  { route: "credentialed_media_asr" as const, failureCode: "V3_MEDIA_PLATFORM_REJECTED" },
  { route: "public_or_page_subtitle" as const, failureCode: "V3_MEDIA_SUBTITLE_UNAVAILABLE" }
];

describe("TrustedTabCaptureCard", () => {
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

  it("does not render before all three ordered machine failures exist", () => {
    act(() => root.render(<TrustedTabCaptureCard failures={failures.slice(0, 2)} state="awaiting_user" onStart={vi.fn()} onFinish={vi.fn()} onCancel={vi.fn()} />));
    expect(host.textContent).toBe("");
  });

  it("renders the trusted command and active stop controls", () => {
    const onStart = vi.fn();
    act(() => root.render(<TrustedTabCaptureCard failures={failures} state="awaiting_user" onStart={onStart} onFinish={vi.fn()} onCancel={vi.fn()} />));
    const start = host.querySelector("[data-testid='media-capture-start']") as HTMLButtonElement;
    act(() => start.click());
    expect(onStart).toHaveBeenCalledTimes(1);
    act(() => root.render(<TrustedTabCaptureCard failures={failures} state="capturing" onStart={onStart} onFinish={vi.fn()} onCancel={vi.fn()} />));
    expect(host.querySelector("[data-testid='media-capture-finish']")).not.toBeNull();
    expect(host.querySelector("[data-testid='media-capture-cancel']")).not.toBeNull();
  });
});

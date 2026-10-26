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

  it("shows an honest experimental boundary without an action by default", () => {
    const onStart = vi.fn();
    act(() => root.render(<TrustedTabCaptureCard failures={failures} state="awaiting_user" onStart={onStart} onFinish={vi.fn()} onCancel={vi.fn()} />));
    expect(host.textContent).toContain("实验能力");
    expect(host.textContent).toContain("不会自动启动");
    expect(host.querySelector("[data-testid='media-capture-start']")).toBeNull();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("renders the trusted command and active stop controls only when explicitly enabled", () => {
    const onStart = vi.fn();
    const onFinish = vi.fn();
    act(() => root.render(<TrustedTabCaptureCard failures={failures} experimentalEnabled state="awaiting_user" onStart={onStart} onFinish={vi.fn()} onCancel={vi.fn()} />));
    const start = host.querySelector("[data-testid='media-capture-start']") as HTMLButtonElement;
    act(() => start.click());
    expect(onStart).toHaveBeenCalledTimes(1);
    act(() => root.render(<TrustedTabCaptureCard failures={failures} experimentalEnabled state="capturing" onStart={onStart} onFinish={onFinish} onCancel={vi.fn()} />));
    const card = host.querySelector("[data-testid='media-capture-card']") as HTMLElement;
    const finish = host.querySelector("[data-testid='media-capture-finish']") as HTMLButtonElement;
    expect(card.dataset.state).toBe("capturing");
    act(() => finish.click());
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(host.querySelector("[data-testid='media-capture-cancel']")).not.toBeNull();
  });
});

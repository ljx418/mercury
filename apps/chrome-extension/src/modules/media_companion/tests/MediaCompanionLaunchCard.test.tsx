import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaCompanionLaunchCard, type MediaCompanionLaunchCardProps } from "../MediaCompanionLaunchCard";
import { BILIBILI_CONSENT_SCOPE_ITEMS } from "../session/bilibili/bilibiliConsentCopy";
import { BILIBILI_SESSION_POLICY_DEFINITION } from "../session/bilibili/bilibiliCookiePolicy";
import { createDefaultConsentPolicy } from "../session/contracts";

const roots: ReturnType<typeof createRoot>[] = [];

async function render(next: Partial<MediaCompanionLaunchCardProps> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const props: MediaCompanionLaunchCardProps = {
    portalLabel: "B站",
    policy: createDefaultConsentPolicy(BILIBILI_SESSION_POLICY_DEFINITION),
    capability: null,
    scopes: BILIBILI_CONSENT_SCOPE_ITEMS,
    sessionBusy: false,
    sessionError: null,
    runtimeStatus: "connecting",
    runtimeError: null,
    credentialState: "idle",
    credentialError: null,
    acquisitionState: "idle",
    acquisitionError: null,
    onEnable: vi.fn(),
    onRetry: vi.fn(),
    onRevoke: vi.fn(),
    ...next
  };
  await act(async () => root.render(<MediaCompanionLaunchCard {...props} />));
  return { container, props };
}

afterEach(async () => {
  while (roots.length) await act(async () => roots.pop()!.unmount());
  document.body.innerHTML = "";
});

describe("MediaCompanionLaunchCard", () => {
  it("shows one primary action before the first grant", async () => {
    const { container, props } = await render();
    expect(container.querySelectorAll("button:not(.media-launch-revoke)")).toHaveLength(1);
    expect(container.textContent).toContain("启用并分析当前视频");
    expect(container.textContent).not.toContain("刷新状态");
    expect(container.textContent).not.toContain("开始分析");
    await act(async () => (container.querySelector("[data-testid='media-companion-enable']") as HTMLButtonElement).click());
    expect(props.onEnable).toHaveBeenCalledOnce();
  });

  it("does not expose a manual start button after grant", async () => {
    const policy = createDefaultConsentPolicy(BILIBILI_SESSION_POLICY_DEFINITION);
    policy.status = "granted";
    policy.scopeGrants.forEach((scope) => { scope.granted = true; });
    const { container } = await render({ policy, runtimeStatus: "connected", credentialState: "establishing" });
    expect(container.textContent).toContain("正在分析");
    expect(container.querySelector("[data-testid='media-companion-enable']")).toBeNull();
    expect(container.querySelector("[data-testid='media-credential-start']")).toBeNull();
  });

  it("offers one retry and keeps revocation in collapsed settings on failure", async () => {
    const policy = createDefaultConsentPolicy(BILIBILI_SESSION_POLICY_DEFINITION);
    policy.status = "granted";
    const { container, props } = await render({
      policy,
      runtimeStatus: "connected",
      credentialState: "failed",
      credentialError: "V3_MEDIA_POLICY_NOT_GRANTED"
    });
    expect(container.textContent).toContain("授权状态已变化");
    await act(async () => (container.querySelector("[data-testid='media-companion-retry']") as HTMLButtonElement).click());
    expect(props.onRetry).toHaveBeenCalledOnce();
    expect(container.querySelector("details")?.open).toBe(false);
    expect(container.querySelector("[data-testid='media-consent-revoke']")).not.toBeNull();
  });

  it("does not misreport a private media directory failure as Runtime offline", async () => {
    const policy = createDefaultConsentPolicy(BILIBILI_SESSION_POLICY_DEFINITION);
    policy.status = "granted";
    const { container } = await render({
      policy,
      runtimeStatus: "connected",
      credentialState: "ready",
      acquisitionState: "failed",
      acquisitionError: "V3_MEDIA_TEMP_FILE_MODE_INVALID"
    });
    expect(container.textContent).toContain("本机媒体临时目录不满足私有权限要求");
    expect(container.textContent).not.toContain("本机伴侣未启动，请先运行");
  });
});


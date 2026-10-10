import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaConsentCard, type MediaConsentCardProps } from "../MediaConsentCard";
import { BILIBILI_CONSENT_SCOPE_ITEMS } from "../session/bilibili/bilibiliConsentCopy";
import { createDefaultConsentPolicy } from "../session/contracts";
import { BILIBILI_SESSION_POLICY_DEFINITION } from "../session/bilibili/bilibiliCookiePolicy";

const roots: ReturnType<typeof createRoot>[] = [];

async function render(next: Partial<MediaConsentCardProps> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const props: MediaConsentCardProps = {
    portalLabel: "B站",
    policy: createDefaultConsentPolicy(BILIBILI_SESSION_POLICY_DEFINITION),
    capability: null,
    scopes: BILIBILI_CONSENT_SCOPE_ITEMS,
    busy: false,
    error: null,
    onAuthorize: vi.fn(),
    onDeny: vi.fn(),
    onRevoke: vi.fn(),
    onRefresh: vi.fn(),
    ...next
  };
  await act(async () => root.render(<MediaConsentCard {...props} />));
  return { container, props };
}

afterEach(async () => {
  while (roots.length) await act(async () => roots.pop()!.unmount());
  document.body.innerHTML = "";
});

describe("MediaConsentCard", () => {
  it("renders all five scopes and the no-overclaim boundary without Cookie names", async () => {
    const { container } = await render();
    expect(container.querySelectorAll(".media-consent-scopes li")).toHaveLength(5);
    expect(container.textContent).toContain("不验证服务端登录");
    expect(container.textContent).toContain("不向 Runtime 发送会话数据");
    expect(container.textContent).not.toContain("SESSDATA");
    expect(container.textContent).not.toContain("bili_jct");
  });

  it("exposes authorize and deny as real buttons before grant", async () => {
    const { container, props } = await render();
    await act(async () => (container.querySelector("[data-testid='media-consent-authorize']") as HTMLButtonElement).click());
    await act(async () => (container.querySelector("[data-testid='media-consent-deny']") as HTMLButtonElement).click());
    expect(props.onAuthorize).toHaveBeenCalledOnce();
    expect(props.onDeny).toHaveBeenCalledOnce();
  });

  it("switches to refresh and revoke after grant", async () => {
    const granted = createDefaultConsentPolicy(BILIBILI_SESSION_POLICY_DEFINITION);
    granted.status = "granted";
    granted.scopeGrants.forEach((scope) => { scope.granted = true; });
    const { container, props } = await render({ policy: granted });
    expect(container.textContent).toContain("已授权，等待检查");
    await act(async () => (container.querySelector("[data-testid='media-consent-refresh']") as HTMLButtonElement).click());
    await act(async () => (container.querySelector("[data-testid='media-consent-revoke']") as HTMLButtonElement).click());
    expect(props.onRefresh).toHaveBeenCalledOnce();
    expect(props.onRevoke).toHaveBeenCalledOnce();
  });

  it("moves focus to a stable action when grant or revoke replaces the initiating button", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const base = createDefaultConsentPolicy(BILIBILI_SESSION_POLICY_DEFINITION);
    const props = {
      portalLabel: "B站",
      capability: null,
      scopes: BILIBILI_CONSENT_SCOPE_ITEMS,
      busy: false,
      error: null,
      onAuthorize: vi.fn(),
      onDeny: vi.fn(),
      onRevoke: vi.fn(),
      onRefresh: vi.fn()
    };
    await act(async () => root.render(<MediaConsentCard {...props} policy={base} />));
    (container.querySelector("[data-testid='media-consent-authorize']") as HTMLButtonElement).focus();

    const granted = createDefaultConsentPolicy(BILIBILI_SESSION_POLICY_DEFINITION);
    granted.status = "granted";
    granted.scopeGrants.forEach((scope) => { scope.granted = true; });
    await act(async () => root.render(<MediaConsentCard {...props} policy={granted} />));
    expect((document.activeElement as HTMLElement).dataset.testid).toBe("media-consent-refresh");

    const revoked = createDefaultConsentPolicy(BILIBILI_SESSION_POLICY_DEFINITION);
    revoked.status = "revoked";
    revoked.scopeGrants.forEach((scope) => { scope.granted = false; });
    await act(async () => root.render(<MediaConsentCard {...props} policy={revoked} />));
    expect((document.activeElement as HTMLElement).dataset.testid).toBe("media-consent-authorize");
  });

  it("restores denial focus only after the asynchronous action is no longer busy", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const base = createDefaultConsentPolicy(BILIBILI_SESSION_POLICY_DEFINITION);
    const props = {
      portalLabel: "B站",
      capability: null,
      scopes: BILIBILI_CONSENT_SCOPE_ITEMS,
      error: null,
      onAuthorize: vi.fn(),
      onDeny: vi.fn(),
      onRevoke: vi.fn(),
      onRefresh: vi.fn()
    };
    await act(async () => root.render(<MediaConsentCard {...props} policy={base} busy={false} />));
    (container.querySelector("[data-testid='media-consent-deny']") as HTMLButtonElement).focus();

    const denied = createDefaultConsentPolicy(BILIBILI_SESSION_POLICY_DEFINITION);
    denied.status = "denied";
    await act(async () => root.render(<MediaConsentCard {...props} policy={denied} busy />));
    expect((container.querySelector("[data-testid='media-consent-deny']") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => root.render(<MediaConsentCard {...props} policy={denied} busy={false} />));
    expect((document.activeElement as HTMLElement).dataset.testid).toBe("media-consent-deny");
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  LOCAL_IMPORT_NAVIGATION_MESSAGE_TYPE,
  LocalImportNavigationGuard,
  parseLocalImportNavigationMessage,
  sourceNavigationIdentity
} from "../LocalImportNavigationGuard";

const IMPORT_ID = `media_import_${"a".repeat(32)}`;
const SOURCE = "portal:bilibili:BV1FIRST:12345:1";

describe("WP-B Background local-import navigation ownership", () => {
  it("accepts only the strict credential-free internal message shape", () => {
    expect(parseLocalImportNavigationMessage({
      type: LOCAL_IMPORT_NAVIGATION_MESSAGE_TYPE,
      command: "register",
      importId: IMPORT_ID,
      sourceIdentity: SOURCE
    })).not.toBeNull();
    expect(parseLocalImportNavigationMessage({
      type: LOCAL_IMPORT_NAVIGATION_MESSAGE_TYPE,
      command: "register",
      importId: IMPORT_ID,
      sourceIdentity: SOURCE,
      bearer: "forbidden"
    })).toBeNull();
    expect(sourceNavigationIdentity(SOURCE)).toBe("BV1FIRST:p1");
    expect(sourceNavigationIdentity("portal:bilibili:BV1FIRST:12345:p1")).toBe("BV1FIRST:p1");
    expect(sourceNavigationIdentity("portal:bilibili:BV1FIRST:12345:part-1")).toBe("BV1FIRST:p1");
  });

  it("cancels exactly once on a real navigation and ignores hash or tracking changes", async () => {
    const cancel = vi.fn(async () => undefined);
    const guard = new LocalImportNavigationGuard(cancel);
    expect(guard.register({
      importId: IMPORT_ID,
      sourceIdentity: SOURCE,
      tabId: 7,
      tabUrl: "https://www.bilibili.com/video/BV1FIRST?p=1"
    })).toBe(true);

    guard.onTabUpdated(7, { url: "https://www.bilibili.com/video/BV1FIRST?p=1&spm_id_from=333#reply" });
    expect(cancel).not.toHaveBeenCalled();
    guard.onTabUpdated(7, { status: "loading", url: "https://www.bilibili.com/video/BV1SECOND" });
    guard.onTabUpdated(7, { status: "loading", url: "https://www.bilibili.com/video/BV1SECOND" });
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(IMPORT_ID);
  });

  it("cancels when another tab becomes active and forgets a completed import", async () => {
    const cancel = vi.fn(async () => undefined);
    const guard = new LocalImportNavigationGuard(cancel);
    expect(guard.register({
      importId: IMPORT_ID,
      sourceIdentity: SOURCE,
      tabId: 7,
      tabUrl: "https://www.bilibili.com/video/BV1FIRST"
    })).toBe(true);
    guard.complete(IMPORT_ID);
    guard.onTabActivated(8);
    expect(cancel).not.toHaveBeenCalled();

    expect(guard.register({
      importId: IMPORT_ID,
      sourceIdentity: SOURCE,
      tabId: 7,
      tabUrl: "https://www.bilibili.com/video/BV1FIRST"
    })).toBe(true);
    guard.onTabActivated(8);
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

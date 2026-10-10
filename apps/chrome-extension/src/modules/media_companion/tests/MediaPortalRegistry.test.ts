import { describe, expect, it } from "vitest";
import {
  listMediaPortalAdapters,
  resolveMediaPortalAdapter
} from "../MediaPortalRegistry";

describe("MediaPortalRegistry", () => {
  it("is a build-time closed set with only the Bilibili implementation target", () => {
    const adapters = listMediaPortalAdapters();
    expect(adapters).toHaveLength(1);
    expect(adapters[0]).toMatchObject({
      adapterId: "bilibili",
      adapterRevision: 1,
      platform: "bilibili"
    });
    expect(adapters[0].capabilities).toEqual([
      "page_identity",
      "public_transcript_discovery",
      "playback_read",
      "playback_seek"
    ]);
  });

  it("matches only the narrow Bilibili video route", () => {
    expect(resolveMediaPortalAdapter("https://www.bilibili.com/video/BV1ZpYd66ELP")?.adapterId).toBe("bilibili");
    expect(resolveMediaPortalAdapter("https://www.bilibili.com/")).toBeNull();
    expect(resolveMediaPortalAdapter("https://www.youtube.com/watch?v=example")).toBeNull();
    expect(resolveMediaPortalAdapter("https://www.xiaohongshu.com/explore/example")).toBeNull();
  });
});

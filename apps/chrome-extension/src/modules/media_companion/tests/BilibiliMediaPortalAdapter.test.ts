import { beforeEach, describe, expect, it } from "vitest";
import { BilibiliMediaPortalAdapter } from "../adapters/bilibili/BilibiliMediaPortalAdapter";
import { parseBilibiliVideoUrl } from "../adapters/bilibili/bilibiliUrl";
import { writeMediaPortalPageState } from "../MediaPortalPageStateBridge";

const adapter = new BilibiliMediaPortalAdapter();

function installPage({
  partIndex = 1,
  subtitles = [] as Array<Record<string, unknown>>,
  body = ""
} = {}) {
  document.head.innerHTML = `
    <script>
      window.__INITIAL_STATE__={"videoData":{"bvid":"BV1ZpYd66ELP","cid":41828944992,"title":"真实视频标题","duration":792,"owner":{"name":"真实作者"},"pages":[{"page":1,"cid":41828944992,"part":"第一部分","duration":792},{"page":2,"cid":41828944993,"part":"第二部分","duration":420}]}};
    </script>
    <script>
      window.__playinfo__={"data":{"subtitle":{"subtitles":${JSON.stringify(subtitles)}}}};
    </script>
  `;
  document.body.innerHTML = `<h1 class="video-title">DOM fallback title</h1><video></video><main>${body}</main>`;
  const video = document.querySelector("video") as HTMLVideoElement;
  Object.defineProperties(video, {
    duration: { configurable: true, value: partIndex === 1 ? 792 : 420 },
    currentTime: { configurable: true, writable: true, value: 12.5 },
    paused: { configurable: true, value: true }
  });
  return video;
}

describe("BilibiliMediaPortalAdapter", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("normalizes Bilibili video URLs without accepting other portal routes", () => {
    expect(parseBilibiliVideoUrl("https://www.bilibili.com/video/BV1ZpYd66ELP?spm_id_from=x")).toEqual({
      bvid: "BV1ZpYd66ELP",
      partIndex: 1,
      canonicalUrl: "https://www.bilibili.com/video/BV1ZpYd66ELP"
    });
    expect(parseBilibiliVideoUrl("https://www.bilibili.com/video/BV1ZpYd66ELP?p=2")).toEqual({
      bvid: "BV1ZpYd66ELP",
      partIndex: 2,
      canonicalUrl: "https://www.bilibili.com/video/BV1ZpYd66ELP?p=2"
    });
    expect(parseBilibiliVideoUrl("https://www.bilibili.com/read/cv123")).toBeNull();
    expect(parseBilibiliVideoUrl("https://www.youtube.com/watch?v=BV1ZpYd66ELP")).toBeNull();
  });

  it("maps Bilibili bootstrap fields into the generic MediaPageContext", async () => {
    installPage({ subtitles: [{ lan: "zh-CN" }] });
    const context = await adapter.collect({
      document,
      href: "https://www.bilibili.com/video/BV1ZpYd66ELP",
      now: () => new Date("2026-09-17T08:00:00.000Z")
    });
    expect(context).toEqual({
      platform: "bilibili",
      adapterId: "bilibili",
      adapterRevision: 1,
      canonicalUrl: "https://www.bilibili.com/video/BV1ZpYd66ELP",
      mediaId: "BV1ZpYd66ELP",
      playbackUnitId: "41828944992",
      part: { id: "p1", index: 1, count: 2, label: "第一部分" },
      title: "真实视频标题",
      author: "真实作者",
      durationSeconds: 792,
      currentTimeSeconds: 12.5,
      transcriptAvailability: "available",
      observedAt: "2026-09-17T08:00:00.000Z"
    });
    expect(Object.keys(context)).not.toContain("bvid");
    expect(Object.keys(context)).not.toContain("cid");
  });

  it("keeps multipart playback identities separate", async () => {
    installPage({ partIndex: 2 });
    const context = await adapter.collect({
      document,
      href: "https://www.bilibili.com/video/BV1ZpYd66ELP?p=2"
    });
    expect(context.playbackUnitId).toBe("41828944993");
    expect(context.part).toEqual({ id: "p2", index: 2, count: 2, label: "第二部分" });
    expect(context.canonicalUrl).toBe("https://www.bilibili.com/video/BV1ZpYd66ELP?p=2");
  });

  it("reads a versioned public-state envelope when page globals are isolated", async () => {
    document.body.innerHTML = "<h1>DOM fallback title</h1><video></video>";
    const video = document.querySelector("video") as HTMLVideoElement;
    Object.defineProperties(video, {
      duration: { configurable: true, value: 792 },
      currentTime: { configurable: true, value: 5 },
      paused: { configurable: true, value: true }
    });
    writeMediaPortalPageState(document, {
      adapterId: "bilibili",
      adapterRevision: 1,
      payload: {
        initialState: {
          videoData: {
            bvid: "BV1ZpYd66ELP",
            cid: 41828944992,
            title: "主世界公开标题",
            duration: 792,
            owner: { name: "主世界公开作者" },
            pages: [{ page: 1, cid: 41828944992, part: "第一部分", duration: 792 }]
          }
        },
        playInfo: { data: { subtitle: { subtitles: [{}] } } }
      }
    });
    const context = await adapter.collect({ document, href: "https://www.bilibili.com/video/BV1ZpYd66ELP" });
    expect(context).toMatchObject({
      mediaId: "BV1ZpYd66ELP",
      playbackUnitId: "41828944992",
      title: "主世界公开标题",
      author: "主世界公开作者",
      transcriptAvailability: "available"
    });
  });

  it("ignores malformed or cross-adapter page-state envelopes", async () => {
    document.documentElement.setAttribute("data-navia-media-portal-state", JSON.stringify({
      adapterId: "youtube",
      adapterRevision: 1,
      payload: { initialState: { videoData: { bvid: "BV1ZpYd66ELP" } } }
    }));
    document.body.innerHTML = "<h1>Only a title</h1>";
    await expect(adapter.collect({ document, href: "https://www.bilibili.com/video/BV1ZpYd66ELP" }))
      .rejects.toThrow("V3_MEDIA_PAGE_IDENTITY_INCOMPLETE");
  });

  it("does not infer transcript availability from titles or descriptions", async () => {
    installPage({ subtitles: [], body: "这是一个写着字幕二字的视频简介，但没有字幕列表。" });
    const context = await adapter.collect({ document, href: "https://www.bilibili.com/video/BV1ZpYd66ELP" });
    expect(context.transcriptAvailability).toBe("unavailable");
  });

  it("does not infer transcript availability from generic player controls", async () => {
    installPage();
    document.head.querySelectorAll("script")[1]?.remove();
    document.body.insertAdjacentHTML("beforeend", "<button class='subtitle-control'>关闭字幕</button>");
    const context = await adapter.collect({ document, href: "https://www.bilibili.com/video/BV1ZpYd66ELP" });
    expect(context.transcriptAvailability).toBe("unknown");
  });

  it("requires independent language and contributor facts for page-declared subtitles", async () => {
    installPage();
    document.body.insertAdjacentHTML("beforeend", `
      <div class="bpx-player-ctrl-subtitle-language-item-text">中文（简体）</div>
      <script type="application/json">{"credits":"字幕制作者（中文（简体））：测试贡献者"}</script>
    `);
    const context = await adapter.collect({ document, href: "https://www.bilibili.com/video/BV1ZpYd66ELP" });
    expect(context.transcriptAvailability).toBe("available");
  });

  it("does not treat a language selector without contributor evidence as an available transcript", async () => {
    installPage();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="bpx-player-ctrl-subtitle-language-item-text">中文</div>'
    );
    const context = await adapter.collect({ document, href: "https://www.bilibili.com/video/BV1ZpYd66ELP" });
    expect(context.transcriptAvailability).toBe("unavailable");
  });

  it("marks restricted pages without exposing session data", async () => {
    installPage({ body: "充电专属，充电后即可观看" });
    const context = await adapter.collect({ document, href: "https://www.bilibili.com/video/BV1ZpYd66ELP" });
    expect(context.transcriptAvailability).toBe("restricted");
    expect(JSON.stringify(context)).not.toMatch(/SESSDATA|bili_jct|Cookie/i);
  });

  it("reads and seeks the actual video element with bounds checks", () => {
    const video = installPage();
    expect(adapter.readPlayback({ document, href: "https://www.bilibili.com/video/BV1ZpYd66ELP" })).toMatchObject({
      currentTimeSeconds: 12.5,
      durationSeconds: 792,
      paused: true
    });
    expect(adapter.seek({ document, href: "https://www.bilibili.com/video/BV1ZpYd66ELP" }, 30)).toMatchObject({
      currentTimeSeconds: 30
    });
    expect(video.currentTime).toBe(30);
    expect(() => adapter.seek({ document, href: "https://www.bilibili.com/video/BV1ZpYd66ELP" }, 900)).toThrow("V3_MEDIA_SEEK_INVALID");
  });

  it("fails closed when identity fields are incomplete", async () => {
    document.body.innerHTML = "<h1>Only a title</h1>";
    await expect(adapter.collect({
      document,
      href: "https://www.bilibili.com/video/BV1ZpYd66ELP"
    })).rejects.toThrow("V3_MEDIA_PAGE_IDENTITY_INCOMPLETE");
  });

  it("never evaluates page assignment code while parsing bootstrap JSON", async () => {
    document.head.innerHTML = `
      <script>window.__INITIAL_STATE__=(globalThis.__naviaExecuted=true, {"videoData":{}})</script>
    `;
    document.body.innerHTML = "<h1>Only a title</h1>";
    await expect(adapter.collect({ document, href: "https://www.bilibili.com/video/BV1ZpYd66ELP" })).rejects.toThrow();
    expect((globalThis as typeof globalThis & { __naviaExecuted?: boolean }).__naviaExecuted).toBeUndefined();
  });
});

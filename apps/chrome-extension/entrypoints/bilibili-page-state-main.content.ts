import { writeMediaPortalPageState } from "../src/modules/media_companion/MediaPortalPageStateBridge";

type UnknownRecord = Record<string, unknown>;

declare global {
  interface Window {
    __INITIAL_STATE__?: unknown;
    __playinfo__?: unknown;
  }
}

export default defineContentScript({
  matches: ["https://www.bilibili.com/video/*"],
  world: "MAIN",
  runAt: "document_idle",
  main() {
    let publicPlayInfo: UnknownRecord | null = null;
    let lastPublicQuery = "";
    const publish = () => {
      const initialState = asRecord(window.__INITIAL_STATE__);
      const videoData = asRecord(initialState?.videoData) ?? asRecord(initialState?.videoInfo);
      if (!initialState || !videoData) return;
      const playInfo = asRecord(window.__playinfo__);
      writeMediaPortalPageState(document, {
        adapterId: "bilibili",
        adapterRevision: 1,
        payload: {
          initialState: {
            bvid: publicString(initialState.bvid),
            cid: publicPositiveNumber(initialState.cid),
            videoData: sanitizeVideoData(videoData)
          },
          playInfo: sanitizePlayInfo(publicPlayInfo ?? playInfo)
        }
      });
    };
    const refreshPublicFacts = async () => {
      const initialState = asRecord(window.__INITIAL_STATE__);
      const videoData = asRecord(initialState?.videoData) ?? asRecord(initialState?.videoInfo);
      const bvid = publicString(videoData?.bvid) ?? publicString(initialState?.bvid);
      const pages = Array.isArray(videoData?.pages) ? videoData.pages : [];
      const requestedPart = Math.max(1, Number.parseInt(new URL(location.href).searchParams.get("p") ?? "1", 10) || 1);
      const selectedPage = asRecord(pages[requestedPart - 1]) ?? asRecord(pages[0]);
      const cid = publicPositiveNumber(selectedPage?.cid)
        ?? publicPositiveNumber(videoData?.cid)
        ?? publicPositiveNumber(initialState?.cid);
      const queryKey = `${bvid ?? ""}:${cid ?? ""}`;
      if (!bvid || cid === null || queryKey === lastPublicQuery) return;
      lastPublicQuery = queryKey;
      try {
        const response = await fetch(
          `https://api.bilibili.com/x/player/wbi/v2?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(String(cid))}`,
          { credentials: "include" }
        );
        if (!response.ok) return;
        const body = asRecord(await response.json());
        if (body?.code !== 0 || !asRecord(body.data)) return;
        publicPlayInfo = body;
        publish();
      } catch {
        // Public discovery is optional; the isolated adapter remains fail-closed.
      }
    };
    publish();
    void refreshPublicFacts();
    window.addEventListener("popstate", () => {
      lastPublicQuery = "";
      publicPlayInfo = null;
      publish();
      void refreshPublicFacts();
    });
    document.addEventListener("visibilitychange", publish);
    window.setInterval(publish, 1_000);
  }
});

function sanitizeVideoData(videoData: UnknownRecord): UnknownRecord {
  const owner = asRecord(videoData.owner);
  const pages = Array.isArray(videoData.pages) ? videoData.pages.slice(0, 200) : [];
  return {
    bvid: publicString(videoData.bvid),
    cid: publicPositiveNumber(videoData.cid),
    title: publicString(videoData.title),
    duration: publicPositiveNumber(videoData.duration),
    videos: publicPositiveNumber(videoData.videos),
    owner: { name: publicString(owner?.name) },
    pages: pages.flatMap((entry, index) => {
      const page = asRecord(entry);
      const cid = publicPositiveNumber(page?.cid);
      if (!page || cid === null) return [];
      return [{
        page: publicPositiveNumber(page.page) ?? index + 1,
        cid,
        part: publicString(page.part),
        duration: publicPositiveNumber(page.duration)
      }];
    })
  };
}

function sanitizePlayInfo(playInfo: UnknownRecord | null): UnknownRecord {
  const data = asRecord(playInfo?.data);
  const subtitle = asRecord(data?.subtitle);
  const subtitles = subtitle?.subtitles ?? subtitle?.list;
  const dash = asRecord(data?.dash);
  return {
    data: {
      subtitle: Array.isArray(subtitles)
        ? { subtitles: subtitles.slice(0, 100).map(() => ({})) }
        : {},
      dash: { duration: publicPositiveNumber(dash?.duration) }
    }
  };
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function publicString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 2_000) : null;
}

function publicPositiveNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

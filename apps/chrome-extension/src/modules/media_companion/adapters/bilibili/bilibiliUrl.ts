export type BilibiliVideoLocation = {
  bvid: string;
  partIndex: number;
  canonicalUrl: string;
};

const BVID_PATTERN = /^BV[0-9A-Za-z]{10}$/;

export function parseBilibiliVideoUrl(href: string): BilibiliVideoLocation | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || url.hostname !== "www.bilibili.com") return null;
    const match = url.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10})(?:\/|$)/);
    if (!match || !BVID_PATTERN.test(match[1])) return null;
    const requestedPart = Number.parseInt(url.searchParams.get("p") ?? "1", 10);
    const partIndex = Number.isInteger(requestedPart) && requestedPart > 0 ? requestedPart : 1;
    const canonicalUrl = new URL(`https://www.bilibili.com/video/${match[1]}`);
    if (partIndex > 1) canonicalUrl.searchParams.set("p", String(partIndex));
    return { bvid: match[1], partIndex, canonicalUrl: canonicalUrl.toString() };
  } catch {
    return null;
  }
}


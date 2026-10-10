import type { TranscriptAvailability } from "../../contracts";
import { readMediaPortalPageState } from "../../MediaPortalPageStateBridge";
import { parseBilibiliVideoUrl } from "./bilibiliUrl";

type UnknownRecord = Record<string, unknown>;

type BilibiliPartState = {
  index: number;
  cid: string;
  label: string | null;
  durationSeconds: number | null;
};

export type BilibiliPageState = {
  bvid: string;
  cid: string;
  canonicalUrl: string;
  part: BilibiliPartState;
  partCount: number;
  title: string;
  author: string;
  durationSeconds: number;
  currentTimeSeconds: number;
  transcriptAvailability: TranscriptAvailability;
};

export function collectBilibiliPageState(documentRef: Document, href: string): BilibiliPageState {
  const location = parseBilibiliVideoUrl(href);
  if (!location) throw new Error("V3_MEDIA_PORTAL_UNSUPPORTED: URL is not a supported Bilibili video page.");

  const bridged = readMediaPortalPageState(documentRef, "bilibili", 1)?.payload;
  const initialState = firstNonEmptyRecord(
    readAssignedJson(documentRef, "__INITIAL_STATE__"),
    asRecord(bridged?.initialState)
  );
  const playInfo = firstNonEmptyRecord(
    readAssignedJson(documentRef, "__playinfo__"),
    asRecord(bridged?.playInfo)
  );
  const videoData = asRecord(initialState.videoData) ?? asRecord(initialState.videoInfo) ?? {};
  const pages = readParts(videoData.pages);
  const partCount = Math.max(1, pages.length || positiveInteger(videoData.videos) || 1);
  const requestedPart = Math.min(location.partIndex, partCount);
  const selectedPart = pages[requestedPart - 1] ?? pages[0] ?? null;
  const video = documentRef.querySelector<HTMLVideoElement>("video");

  const bvid = cleanString(videoData.bvid) || cleanString(initialState.bvid) || location.bvid;
  const cid =
    selectedPart?.cid ||
    cleanNumericString(videoData.cid) ||
    cleanNumericString(initialState.cid);
  const title =
    cleanString(videoData.title) ||
    textFrom(documentRef, "h1.video-title, h1[title], h1") ||
    metaContent(documentRef, "meta[property='og:title'], meta[name='title']") ||
    cleanDocumentTitle(documentRef.title);
  const author =
    cleanString(asRecord(videoData.owner)?.name) ||
    textFrom(documentRef, ".up-name, .up-info-container .name, [class*='up-name']") ||
    metaContent(documentRef, "meta[name='author'], meta[itemprop='author']");
  const durationSeconds = firstPositiveFinite(
    video?.duration,
    selectedPart?.durationSeconds,
    videoData.duration,
    asRecord(asRecord(playInfo.data)?.dash)?.duration
  );
  const currentTimeSeconds = nonNegativeFinite(video?.currentTime) ?? 0;

  if (!BVID_PATTERN.test(bvid) || !cid || !title || !author || !durationSeconds) {
    throw new Error("V3_MEDIA_PAGE_IDENTITY_INCOMPLETE: Bilibili page identity is incomplete.");
  }

  return {
    bvid,
    cid,
    canonicalUrl: canonicalUrlFor(location.bvid, requestedPart),
    part: {
      index: requestedPart,
      cid,
      label: selectedPart?.label ?? null,
      durationSeconds: selectedPart?.durationSeconds ?? null
    },
    partCount,
    title,
    author,
    durationSeconds,
    currentTimeSeconds,
    transcriptAvailability: resolveTranscriptAvailability(documentRef, playInfo)
  };
}

export function readAssignedJson(documentRef: Document, assignmentName: string): UnknownRecord {
  const assignment = new RegExp(`(?:window\\.)?${escapeRegExp(assignmentName)}\\s*=`, "g");
  for (const script of Array.from(documentRef.scripts)) {
    const source = script.textContent ?? "";
    assignment.lastIndex = 0;
    for (let match = assignment.exec(source); match; match = assignment.exec(source)) {
      const objectStart = source.indexOf("{", match.index + match[0].length);
      if (objectStart < 0) continue;
      const json = sliceBalancedObject(source, objectStart);
      if (!json) continue;
      try {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as UnknownRecord;
      } catch {
        // Ignore malformed or non-JSON assignments; page code is never evaluated.
      }
    }
  }
  return {};
}

function sliceBalancedObject(source: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

function readParts(value: unknown): BilibiliPartState[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, arrayIndex) => {
    const part = asRecord(entry);
    if (!part) return [];
    const cid = cleanNumericString(part.cid);
    if (!cid) return [];
    return [{
      index: positiveInteger(part.page) || arrayIndex + 1,
      cid,
      label: cleanString(part.part) || null,
      durationSeconds: positiveFinite(part.duration)
    }];
  });
}

function resolveTranscriptAvailability(documentRef: Document, playInfo: UnknownRecord): TranscriptAvailability {
  const bodyText = documentRef.body?.innerText ?? documentRef.body?.textContent ?? "";
  if (/充电专属|会员专享|登录后观看|地区限制|视频不见了|试看中/.test(bodyText)) return "restricted";
  const subtitle = asRecord(asRecord(playInfo.data)?.subtitle);
  const list = subtitle?.subtitles ?? subtitle?.list;
  if (Array.isArray(list) && list.length > 0) return "available";

  // Anonymous Bilibili player APIs can omit subtitle rows that the page still
  // exposes. Require two independent page facts so generic subtitle controls,
  // titles, or descriptions cannot promote an unavailable transcript.
  if (hasConcreteSubtitleLanguage(documentRef) && hasSubtitleContributorFact(documentRef)) {
    return "available";
  }
  if (Array.isArray(list)) return "unavailable";
  return "unknown";
}

function hasConcreteSubtitleLanguage(documentRef: Document): boolean {
  return Array.from(documentRef.querySelectorAll(".bpx-player-ctrl-subtitle-language-item-text"))
    .some((node) => {
      const value = cleanString(node.textContent);
      return value.length > 0 && !GENERIC_SUBTITLE_LABELS.has(value);
    });
}

function hasSubtitleContributorFact(documentRef: Document): boolean {
  const html = documentRef.documentElement?.innerHTML ?? "";
  return /字幕制作者\s*[（(]/.test(html);
}

function canonicalUrlFor(bvid: string, partIndex: number): string {
  const url = new URL(`https://www.bilibili.com/video/${bvid}`);
  if (partIndex > 1) url.searchParams.set("p", String(partIndex));
  return url.toString();
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function firstNonEmptyRecord(...values: Array<UnknownRecord | null>): UnknownRecord {
  return values.find((value) => value && Object.keys(value).length > 0) ?? {};
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanNumericString(value: unknown): string {
  const result = typeof value === "number" ? String(value) : cleanString(value);
  return /^\d+$/.test(result) && result !== "0" ? result : "";
}

function positiveInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function positiveFinite(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nonNegativeFinite(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function firstPositiveFinite(...values: unknown[]): number | null {
  for (const value of values) {
    const number = positiveFinite(value);
    if (number !== null) return number;
  }
  return null;
}

function textFrom(documentRef: Document, selector: string): string {
  return cleanString(documentRef.querySelector(selector)?.textContent);
}

function metaContent(documentRef: Document, selector: string): string {
  return cleanString(documentRef.querySelector(selector)?.getAttribute("content"));
}

function cleanDocumentTitle(value: string): string {
  return cleanString(value).replace(/_哔哩哔哩_bilibili$/i, "").replace(/-哔哩哔哩.*$/i, "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BVID_PATTERN = /^BV[0-9A-Za-z]{10}$/;
const GENERIC_SUBTITLE_LABELS = new Set([
  "字幕",
  "关闭",
  "添加字幕",
  "暂无字幕",
  "主字幕",
  "副字幕",
  "双语字幕",
  "字幕设置"
]);

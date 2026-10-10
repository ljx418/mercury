export const MEDIA_PORTAL_PAGE_STATE_ATTRIBUTE = "data-navia-media-portal-state";

export type MediaPortalPageStateEnvelope = {
  adapterId: string;
  adapterRevision: number;
  payload: Record<string, unknown>;
};

const MAX_SERIALIZED_BYTES = 128 * 1024;

export function writeMediaPortalPageState(
  documentRef: Document,
  envelope: MediaPortalPageStateEnvelope
): boolean {
  if (!isEnvelope(envelope)) return false;
  const serialized = JSON.stringify(envelope);
  if (new TextEncoder().encode(serialized).byteLength > MAX_SERIALIZED_BYTES) return false;
  documentRef.documentElement?.setAttribute(MEDIA_PORTAL_PAGE_STATE_ATTRIBUTE, serialized);
  return true;
}

export function readMediaPortalPageState(
  documentRef: Document,
  adapterId: string,
  adapterRevision: number
): MediaPortalPageStateEnvelope | null {
  const serialized = documentRef.documentElement?.getAttribute(MEDIA_PORTAL_PAGE_STATE_ATTRIBUTE);
  if (!serialized || serialized.length > MAX_SERIALIZED_BYTES) return null;
  try {
    const value = JSON.parse(serialized);
    return isEnvelope(value)
      && value.adapterId === adapterId
      && value.adapterRevision === adapterRevision
      ? value
      : null;
  } catch {
    return null;
  }
}

function isEnvelope(value: unknown): value is MediaPortalPageStateEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.adapterId === "string"
    && /^[a-z][a-z0-9_-]{1,63}$/.test(record.adapterId)
    && Number.isInteger(record.adapterRevision)
    && Number(record.adapterRevision) > 0
    && Boolean(record.payload)
    && typeof record.payload === "object"
    && !Array.isArray(record.payload);
}

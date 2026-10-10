import type { PortalSessionAdapter } from "./PortalSessionAdapter";

export class PortalSessionRegistry {
  readonly #adapters: readonly PortalSessionAdapter[];
  readonly #byAdapterId: ReadonlyMap<string, PortalSessionAdapter>;

  constructor(adapters: readonly PortalSessionAdapter[]) {
    const byAdapterId = new Map<string, PortalSessionAdapter>();
    const sessionAdapterIds = new Set<string>();

    for (const adapter of adapters) {
      const { adapterId, sessionAdapterId } = adapter.definition;
      if (byAdapterId.has(adapterId)) {
        throw new Error(`V3_MEDIA_SESSION_ADAPTER_DUPLICATE: ${adapterId}`);
      }
      if (sessionAdapterIds.has(sessionAdapterId)) {
        throw new Error(`V3_MEDIA_SESSION_ADAPTER_DUPLICATE: ${sessionAdapterId}`);
      }
      byAdapterId.set(adapterId, adapter);
      sessionAdapterIds.add(sessionAdapterId);
    }

    this.#adapters = Object.freeze([...adapters]);
    this.#byAdapterId = byAdapterId;
  }

  list(): readonly PortalSessionAdapter[] {
    return this.#adapters;
  }

  resolve(adapterId: string): PortalSessionAdapter | null {
    return this.#byAdapterId.get(adapterId) ?? null;
  }
}


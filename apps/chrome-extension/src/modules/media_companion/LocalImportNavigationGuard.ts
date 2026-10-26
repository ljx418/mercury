import { mediaNavigationIdentity } from "./localImportEntry";

export const LOCAL_IMPORT_NAVIGATION_MESSAGE_TYPE = "navia.localImport.navigation" as const;

const IMPORT_ID = /^media_import_[a-f0-9]{32}$/;
const SOURCE_IDENTITY = /^portal:bilibili:([^:]+):([^:]+):([^:]+)$/;

export type LocalImportNavigationMessage =
  | { type: typeof LOCAL_IMPORT_NAVIGATION_MESSAGE_TYPE; command: "register"; importId: string; sourceIdentity: string }
  | { type: typeof LOCAL_IMPORT_NAVIGATION_MESSAGE_TYPE; command: "complete"; importId: string };

export function parseLocalImportNavigationMessage(value: unknown): LocalImportNavigationMessage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type !== LOCAL_IMPORT_NAVIGATION_MESSAGE_TYPE || !IMPORT_ID.test(String(record.importId ?? ""))) return null;
  if (record.command === "complete" && Object.keys(record).length === 3) {
    return record as LocalImportNavigationMessage;
  }
  if (
    record.command === "register" &&
    Object.keys(record).length === 4 &&
    SOURCE_IDENTITY.test(String(record.sourceIdentity ?? ""))
  ) {
    return record as LocalImportNavigationMessage;
  }
  return null;
}

export function sourceNavigationIdentity(sourceIdentity: string): string | null {
  const match = SOURCE_IDENTITY.exec(sourceIdentity);
  if (!match) return null;
  const part = /^(?:p|part-)?([1-9][0-9]*)$/.exec(match[3]);
  return part ? `${match[1]}:p${part[1]}` : null;
}

type Binding = { importId: string; tabId: number; navigationIdentity: string };

export class LocalImportNavigationGuard {
  readonly #cancel: (importId: string) => Promise<unknown>;
  readonly #bindings = new Map<string, Binding>();

  constructor(cancel: (importId: string) => Promise<unknown>) {
    this.#cancel = cancel;
  }

  register(input: { importId: string; sourceIdentity: string; tabId: number; tabUrl: string }): boolean {
    if (!IMPORT_ID.test(input.importId) || !Number.isInteger(input.tabId) || input.tabId < 0) return false;
    const sourceIdentity = sourceNavigationIdentity(input.sourceIdentity);
    const tabIdentity = mediaNavigationIdentity(input.tabUrl);
    if (!sourceIdentity || sourceIdentity !== tabIdentity) return false;
    this.#bindings.set(input.importId, {
      importId: input.importId,
      tabId: input.tabId,
      navigationIdentity: sourceIdentity
    });
    return true;
  }

  complete(importId: string): void {
    this.#bindings.delete(importId);
  }

  onTabUpdated(tabId: number, change: { status?: string; url?: string }): void {
    const nextIdentity = typeof change.url === "string" ? mediaNavigationIdentity(change.url) : null;
    for (const binding of this.#bindings.values()) {
      if (binding.tabId !== tabId) continue;
      if (change.status === "loading" || (typeof change.url === "string" && nextIdentity !== binding.navigationIdentity)) {
        this.#cancelOnce(binding);
      }
    }
  }

  onTabActivated(tabId: number): void {
    for (const binding of this.#bindings.values()) {
      if (binding.tabId !== tabId) this.#cancelOnce(binding);
    }
  }

  onTabRemoved(tabId: number): void {
    for (const binding of this.#bindings.values()) {
      if (binding.tabId === tabId) this.#cancelOnce(binding);
    }
  }

  #cancelOnce(binding: Binding): void {
    if (!this.#bindings.delete(binding.importId)) return;
    void this.#cancel(binding.importId).catch(() => undefined);
  }
}

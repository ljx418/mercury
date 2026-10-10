import type { MediaConsentPolicyStore } from "./MediaConsentPolicyStore";
import type { PortalPermissionClient } from "./PortalPermissionClient";
import type { PortalSessionBroker } from "./PortalSessionBroker";
import {
  PORTAL_SESSION_MESSAGE_TYPE,
  type PortalSessionCommandMessage,
  type PortalSessionMessageResponse
} from "./PortalSessionMessageClient";

export type PortalSessionMessageSender = {
  id?: string;
  url?: string;
  hasTab: boolean;
};

export type PortalSessionMessageRouterDependencies = {
  runtimeId: string;
  extensionBaseUrl: string;
  policyStore: Pick<MediaConsentPolicyStore, "getPolicy" | "recordGrant" | "recordDenial" | "revokePolicy">;
  permissionClient: Pick<PortalPermissionClient, "containsForAdapter" | "remove">;
  broker: Pick<PortalSessionBroker, "inspectCapability">;
};

const documentPaths = new Set(["sidepanel.html", "workspace.html"]);
const commandKeys: Record<PortalSessionCommandMessage["command"], readonly string[]> = {
  get_policy: ["adapterId", "command", "type"],
  record_grant: ["adapterId", "command", "type"],
  record_denial: ["adapterId", "command", "type"],
  revoke_policy: ["adapterId", "command", "type"],
  inspect_capability: ["adapterId", "command", "policyRevision", "type"]
};

function isTrustedExtensionDocument(sender: PortalSessionMessageSender, dependencies: PortalSessionMessageRouterDependencies) {
  if (sender.id !== dependencies.runtimeId || !sender.url) return false;
  if (!sender.url.startsWith(dependencies.extensionBaseUrl)) return false;
  const relativePath = sender.url.slice(dependencies.extensionBaseUrl.length).split(/[?#]/, 1)[0];
  return documentPaths.has(relativePath);
}

function parseCommand(value: unknown): PortalSessionCommandMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.type !== PORTAL_SESSION_MESSAGE_TYPE || typeof record.command !== "string") return null;
  if (!(record.command in commandKeys)) return null;
  if (typeof record.adapterId !== "string" || !/^[a-z][a-z0-9_-]{1,31}$/.test(record.adapterId)) return null;
  const command = record.command as PortalSessionCommandMessage["command"];
  const actualKeys = Object.keys(record).sort();
  const expectedKeys = [...commandKeys[command]].sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) return null;
  if (command === "inspect_capability") {
    if (!Number.isInteger(record.policyRevision) || Number(record.policyRevision) < 1) return null;
    return {
      type: PORTAL_SESSION_MESSAGE_TYPE,
      command,
      adapterId: record.adapterId,
      policyRevision: Number(record.policyRevision)
    };
  }
  return { type: PORTAL_SESSION_MESSAGE_TYPE, command, adapterId: record.adapterId };
}

function failure(failureCode: string): PortalSessionMessageResponse<never> {
  return { ok: false, failureCode };
}

export class PortalSessionMessageRouter {
  readonly #dependencies: PortalSessionMessageRouterDependencies;

  constructor(dependencies: PortalSessionMessageRouterDependencies) {
    this.#dependencies = dependencies;
  }

  async handle(rawMessage: unknown, sender: PortalSessionMessageSender): Promise<PortalSessionMessageResponse<unknown>> {
    if (!isTrustedExtensionDocument(sender, this.#dependencies)) {
      return failure("V3_MEDIA_SESSION_PERMISSION_DENIED");
    }
    const message = parseCommand(rawMessage);
    if (!message) return failure("V3_MEDIA_SESSION_POLICY_MISMATCH");

    try {
      if (message.command === "get_policy") {
        const policy = await this.#dependencies.policyStore.getPolicy(message.adapterId);
        return policy ? { ok: true, value: policy } : failure("V3_MEDIA_SESSION_ADAPTER_UNSUPPORTED");
      }
      if (message.command === "record_denial") {
        return { ok: true, value: await this.#dependencies.policyStore.recordDenial(message.adapterId) };
      }
      if (message.command === "record_grant") {
        const permissionState = await this.#dependencies.permissionClient.containsForAdapter(message.adapterId);
        if (!permissionState.namedPermissionGranted || !permissionState.hostPermissionGranted) {
          return failure("V3_MEDIA_SESSION_PERMISSION_REQUIRED");
        }
        return { ok: true, value: await this.#dependencies.policyStore.recordGrant(message.adapterId) };
      }
      if (message.command === "revoke_policy") {
        await this.#dependencies.permissionClient.remove(message.adapterId);
        const permissionState = await this.#dependencies.permissionClient.containsForAdapter(message.adapterId);
        if (permissionState.namedPermissionGranted || permissionState.hostPermissionGranted) {
          return failure("V3_MEDIA_SESSION_READ_FAILED");
        }
        return { ok: true, value: await this.#dependencies.policyStore.revokePolicy(message.adapterId) };
      }
      return {
        ok: true,
        value: await this.#dependencies.broker.inspectCapability({
          adapterId: message.adapterId,
          policyRevision: message.policyRevision
        })
      };
    } catch {
      return failure("V3_MEDIA_SESSION_READ_FAILED");
    }
  }
}

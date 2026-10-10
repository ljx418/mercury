import type {
  MediaConsentPolicyRecord,
  PortalPermissionState,
  PortalSessionCapability,
  PortalSessionPolicyDefinition
} from "./contracts";

export type PortalSessionAdapterContext = {
  policy: MediaConsentPolicyRecord;
  permissionState: PortalPermissionState;
  observedAt: Date;
};

export interface PortalSessionAdapter {
  readonly definition: PortalSessionPolicyDefinition;
  inspectCapability(context: PortalSessionAdapterContext): Promise<PortalSessionCapability>;
}


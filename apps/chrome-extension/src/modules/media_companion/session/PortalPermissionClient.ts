import type { PortalSessionRegistry } from "./PortalSessionRegistry";
import type { PortalPermissionDescriptor, PortalPermissionReader, PortalPermissionState } from "./contracts";

export interface PortalPermissionsApi {
  request(descriptor: chrome.permissions.Permissions): Promise<boolean>;
  contains(descriptor: chrome.permissions.Permissions): Promise<boolean>;
  remove(descriptor: chrome.permissions.Permissions): Promise<boolean>;
}

export type PortalPermissionClientDependencies = {
  registry: PortalSessionRegistry;
  permissionsApi: PortalPermissionsApi;
};

function cloneDescriptor(descriptor: PortalPermissionDescriptor) {
  return {
    permissions: [...descriptor.permissions],
    origins: [...descriptor.origins]
  };
}

export class PortalPermissionClient implements PortalPermissionReader {
  readonly #dependencies: PortalPermissionClientDependencies;

  constructor(dependencies: PortalPermissionClientDependencies) {
    this.#dependencies = dependencies;
  }

  async request(adapterId: string): Promise<PortalPermissionState> {
    const definition = this.#resolve(adapterId);
    const descriptor = cloneDescriptor(definition.permissionDescriptor);
    const granted = await this.#dependencies.permissionsApi.request(descriptor);
    if (!granted) {
      return { namedPermissionGranted: false, hostPermissionGranted: false };
    }
    return this.contains(definition.permissionDescriptor);
  }

  async contains(descriptor: PortalPermissionDescriptor): Promise<PortalPermissionState> {
    const namedPermissionGranted = await this.#dependencies.permissionsApi.contains({
      permissions: [...descriptor.permissions]
    });
    const hostPermissionGranted = await this.#dependencies.permissionsApi.contains({
      origins: [...descriptor.origins]
    });
    return { namedPermissionGranted, hostPermissionGranted };
  }

  async containsForAdapter(adapterId: string): Promise<PortalPermissionState> {
    const definition = this.#resolve(adapterId);
    return this.contains(definition.permissionDescriptor);
  }

  async remove(adapterId: string): Promise<boolean> {
    const definition = this.#resolve(adapterId);
    return this.#dependencies.permissionsApi.remove(cloneDescriptor(definition.permissionDescriptor));
  }

  #resolve(adapterId: string) {
    const adapter = this.#dependencies.registry.resolve(adapterId);
    if (!adapter) throw new Error("V3_MEDIA_SESSION_ADAPTER_UNSUPPORTED");
    return adapter.definition;
  }
}

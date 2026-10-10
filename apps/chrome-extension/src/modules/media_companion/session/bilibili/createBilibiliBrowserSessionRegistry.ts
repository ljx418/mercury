import { PortalSessionRegistry } from "../PortalSessionRegistry";
import { BilibiliPortalSessionAdapter } from "./BilibiliPortalSessionAdapter";

export function createBilibiliBrowserSessionRegistry(onCookieRead?: () => void): PortalSessionRegistry {
  return new PortalSessionRegistry([
    new BilibiliPortalSessionAdapter({
      async getAll(details) {
        onCookieRead?.();
        const cookies = await chrome.cookies.getAll(details);
        return cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain
        }));
      }
    })
  ]);
}

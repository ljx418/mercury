import { defineConfig } from "wxt";

export default defineConfig({
  outDir: "chrome-mv3-unpacked",
  outDirTemplate: ".",
  vite: () => ({
    define: {
      __NAVIA_E2E_BRIDGE__: JSON.stringify(process.env.NAVIA_E2E_BRIDGE === "1")
    }
  }),
  manifest: {
    name: "Navia",
    description: "In-page companion reading with a local headless runtime.",
    version: "0.1.0",
    permissions: ["activeTab", "offscreen", "scripting", "sidePanel", "storage", "tabCapture", "tabs"],
    optional_permissions: ["cookies"],
    host_permissions: ["http://127.0.0.1:17861/*", "http://localhost:17861/*"],
    optional_host_permissions: ["https://*.bilibili.com/*"],
    action: {
      default_title: "Open Navia"
    },
    commands: {
      _execute_action: {
        suggested_key: {
          default: "Alt+Shift+N",
          mac: "Alt+Shift+N"
        },
        description: "Open Navia"
      },
      "open-navia-sidepanel": {
        suggested_key: {
          default: "Ctrl+Shift+Y",
          mac: "Ctrl+Shift+Y"
        },
        description: "Open Navia Side Panel"
      }
    },
    side_panel: {
      default_path: "sidepanel.html"
    },
    web_accessible_resources: [
      {
        resources: ["sidepanel.html", "mermaid-renderer.html", "assets/*", "chunks/*"],
        matches: ["https://www.bilibili.com/*"]
      }
    ]
  }
});

/**
 * The production binding between the Runtime's four local-import routes and the
 * strict Extension client.
 *
 * The acquisition page builds its client through THIS factory, so the URL, the
 * bearer and the session generation can never be assembled ad hoc at a call
 * site. The bearer and the generation are read at call time by the client
 * itself, so a Runtime session change is picked up without rebuilding anything.
 */

import {
  RUNTIME_URL,
  cancelLocalMediaImport,
  createLocalMediaImport,
  getLocalMediaImport,
  getLocalRuntimeBearer,
  getLocalRuntimeGeneration
} from "../../runtimeClient";
import { createLocalImportClient, type LocalImportClient } from "./LocalMediaImportClient";
import { LOCAL_IMPORT_NAVIGATION_MESSAGE_TYPE } from "./LocalImportNavigationGuard";

export function createLocalImportRuntimeClient(): LocalImportClient {
  return createLocalImportClient({
    runtimeBaseUrl: RUNTIME_URL,
    transport: {
      post: (_path, body) =>
        createLocalMediaImport(body as {
          taskId: string;
          sourceIdentity: string;
          declaredMediaType: string;
          byteLength: number;
        }),
      get: (path) => getLocalMediaImport(path.split("/").pop() ?? ""),
      delete: (path) => cancelLocalMediaImport(path.split("/").pop() ?? "")
    },
    bearer: getLocalRuntimeBearer,
    generation: getLocalRuntimeGeneration,
    onImportCreated: async (record, sourceIdentity) => {
      const response = await chrome.runtime.sendMessage({
        type: LOCAL_IMPORT_NAVIGATION_MESSAGE_TYPE,
        command: "register",
        importId: record.importId,
        sourceIdentity
      });
      if (response?.ok !== true) throw new Error("本地导入无法绑定当前标签页。");
    },
    onImportTerminal: (record) => chrome.runtime.sendMessage({
      type: LOCAL_IMPORT_NAVIGATION_MESSAGE_TYPE,
      command: "complete",
      importId: record.importId
    }).then(() => undefined)
  });
}

/**
 * The CURRENT session generation, read at call time.
 *
 * It is exported so the acquisition page hands the card the same live value the
 * client already uses, instead of capturing one at render time.
 */
export function localImportSessionGeneration(): number {
  return getLocalRuntimeGeneration();
}

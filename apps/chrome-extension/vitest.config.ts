import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    pool: "threads",
    maxWorkers: 4
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        types: ["vitest/globals", "chrome"],
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        skipLibCheck: true
      }
    }
  }
});

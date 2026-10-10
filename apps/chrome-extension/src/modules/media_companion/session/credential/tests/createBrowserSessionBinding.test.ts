import { describe, expect, it } from "vitest";
import { createBrowserSessionBinding } from "../createBrowserSessionBinding";

describe("createBrowserSessionBinding", () => {
  it("is stable within one service-worker instance and changes after restart", async () => {
    const first = createBrowserSessionBinding();
    const second = createBrowserSessionBinding();
    const firstValue = await first();
    expect(await first()).toBe(firstValue);
    expect(firstValue).toMatch(/^[a-f0-9]{64}$/);
    expect(await second()).toMatch(/^[a-f0-9]{64}$/);
    expect(await second()).not.toBe(firstValue);
  });
});

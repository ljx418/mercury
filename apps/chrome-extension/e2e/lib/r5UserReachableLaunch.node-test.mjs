import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../entrypoints/sidepanel/main.tsx", import.meta.url), "utf8");

test("the media launch action is composed before collapsed diagnostics", () => {
  const chatStage = source.indexOf('<section className="chat-stage"');
  const launchCard = source.indexOf("<MediaCompanionLaunchCard", chatStage);
  const diagnostics = source.indexOf('<details className="chat-context-dock"', chatStage);

  assert.ok(chatStage >= 0);
  assert.ok(launchCard > chatStage);
  assert.ok(diagnostics > launchCard);
  assert.equal(source.indexOf("<MediaCompanionLaunchCard", launchCard + 1), -1);
});

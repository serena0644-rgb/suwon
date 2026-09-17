import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function load(file, modules, globals = {}) {
  const source = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, require: name => modules[name], console: { error() {} }, process: { env: {} }, AbortController, DOMException, setTimeout, clearTimeout, ...globals });
  return exports;
}
function routeApi(keyed, fetchWalkLeg) {
  return load("app/api/route/walk/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    "@/lib/routing/geo": { pathLength: () => 0 },
    "@/lib/routing/constants": { DEFAULT_WALK_SPEED_KMH: 3 },
    "@/lib/routing/types": { isWalkOption: value => value === "no-stairs" },
    "@/lib/routing/tmap": { hasTmapKey: () => keyed, fetchWalkLeg },
  });
}
const points = [{ name: "Test start", lat: 37, lng: 127 }, { name: "Test goal", lat: 37.001, lng: 127.001 }];
test("missing provider key and provider failure never return a fabricated route", async () => {
  const request = { json: async () => ({ points }) };
  const missing = await routeApi(false).POST(request);
  assert.equal(missing.status, 503);
  assert.equal(missing.body.route, null);
  const failed = await routeApi(true, async () => { throw new Error("Test provider failure"); }).POST(request);
  assert.equal(failed.status, 502);
  assert.equal(failed.body.route, null);
});
test("invalid coordinates are rejected instead of becoming zero or silently removed", async () => {
  const api = routeApi(false);
  for (const lat of [null, "", "37", 91]) {
    const result = await api.POST({ json: async () => ({ points: [...points, { name: "Invalid test point", lat, lng: 127 }] }) });
    assert.equal(result.status, 400);
  }
});
test("successful real-provider legs preserve path and warnings", async () => {
  const api = routeApi(true, async (from, to) => ({ from, to, path: points, steps: [{ kind: "stairs", description: "Test stairs", position: from, distance: 20, legIndex: 0, warning: "Test warning" }], distance: 120, duration: 90, fallback: false }));
  const result = await api.POST({ json: async () => ({ points }) });
  assert.equal(result.body.source, "tmap");
  assert.equal(result.body.route.distance, 120);
  assert.equal(result.body.route.warnings[0], "Test warning");
});
test("stairs-exclusion failure is not retried with an unsafe recommendation", async () => {
  let calls = 0;
  const api = load("lib/routing/tmap.ts", { "./geo": {} }, {
    process: { env: { TMAP_APP_KEY: "test-only-key" } },
    fetch: async () => { calls++; return { ok: false, status: 500, json: async () => ({ error: { message: "Test failure" } }) }; },
  });
  await assert.rejects(() => api.fetchWalkLeg(points[0], points[1], "no-stairs", 3));
  assert.equal(calls, 1);
});

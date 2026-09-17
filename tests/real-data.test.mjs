import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function load(file, globals = {}) {
  const source = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, process: { env: {} }, AbortSignal, Event, crypto: { randomUUID }, ...globals });
  return exports;
}
function storage() {
  const values = new Map();
  return { localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }, dispatchEvent() {} };
}
test("legacy demo storage and malformed data never populate empty selections", () => {
  const window = storage();
  window.localStorage.setItem("suwon-ddp-routes", JSON.stringify([{ id: "hwaseong-mural-walk" }]));
  const api = load("lib/selection.ts", { window });
  assert.equal(api.readSaved().parking, null);
  assert.equal(api.readSaved().courses.length, 0);
  window.localStorage.setItem(api.STORAGE_KEY, "{broken");
  assert.equal(api.readSaved().courses.length, 0);
  assert.equal(api.saveCourse([], null), null);
});
test("explicitly saved places persist and deleted courses stay deleted", () => {
  const window = storage();
  const api = load("lib/selection.ts", { window });
  const fixture = { id: "test-only-place", name: "Test fixture", address: "", lat: 37, lng: 127, source: "kakao" };
  assert.equal(api.saveParking(fixture), true);
  assert.ok(api.saveCourse([fixture], fixture));
  assert.equal(api.readSaved().courses.length, 1);
  assert.equal(api.readSaved().parking.id, fixture.id);
  api.writeSaved({ ...api.readSaved(), courses: [] });
  assert.equal(api.readSaved().courses.length, 0);
  assert.equal(api.saveCourse([{ ...fixture, lat: NaN }], null), null);
});
test("storage denial returns an empty state and reports failed saves", () => {
  const api = load("lib/selection.ts", { window: { localStorage: { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } }, dispatchEvent() {} } });
  assert.equal(api.readSaved().courses.length, 0);
  assert.equal(api.writeSaved({ version: 1, parking: null, courses: [] }), false);
});
test("provider-level errors are rejected rather than treated as empty successful responses", async () => {
  const api = load("lib/tour/api.ts", { fetch: async () => ({ ok: true, json: async () => ({ response: { header: { resultCode: "30" }, body: {} } }) }) });
  await assert.rejects(() => api.requestApi("https://test.invalid"));
  assert.equal(api.buildUrl(api.TOUR_BASE_URL, "searchKeyword2", { keyword: "test" }), null);
});
test("normalization preserves missing fields and a genuine zero-result response", () => {
  const api = load("lib/tour/api.ts");
  const item = api.normalize({ contentid: "test-id", title: "Test fixture" });
  assert.equal(item.mapX, "");
  assert.equal(item.address, "");
  assert.equal(item.tel, "");
  assert.equal(api.getItems({ response: { body: { items: {} } } }).length, 0);
});

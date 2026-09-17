import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function handler({
  profile = { email: "fixture@example.invalid" },
  valid = false,
  lookupError = null,
} = {}) {
  const source = readFileSync(
    new URL("../supabase/functions/username-login/index.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  let serve,
    passwordChecks = 0;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile, error: lookupError }),
        }),
      }),
    }),
    auth: {
      signInWithPassword: async () => {
        passwordChecks++;
        return valid
          ? {
              data: {
                session: {
                  access_token: "fixture-access",
                  refresh_token: "fixture-refresh",
                },
              },
              error: null,
            }
          : { data: {}, error: { status: 400 } };
      },
    },
  };
  const env = {
    SUPABASE_URL: "https://example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-secret",
    SUPABASE_ANON_KEY: "fixture-public",
  };
  runInNewContext(compiled, {
    exports: {},
    require: () => ({ createClient: () => client }),
    Response,
    Deno: {
      env: { get: (key) => env[key] },
      serve: (callback) => {
        serve = callback;
      },
    },
  });
  return {
    run: (body) =>
      serve(
        new Request("https://example.invalid", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      ),
    passwordChecks: () => passwordChecks,
  };
}
test("invalid input does not issue a session or attempt password authentication", async () => {
  const api = handler({ valid: true });
  const response = await api.run({
    username: "!",
    password: "fixture-password",
  });
  assert.equal(response.status, 400);
  assert.equal(api.passwordChecks(), 0);
  assert.equal((await response.json()).access_token, undefined);
});
test("unknown usernames and wrong passwords return the same failure without email disclosure", async () => {
  const unknown = await handler({ profile: null }).run({
    username: "fixture_user",
    password: "wrong",
  });
  const wrong = await handler().run({
    username: "fixture_user",
    password: "wrong",
  });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.deepEqual(await unknown.json(), await wrong.json());
});
test("tokens are returned only after password authentication succeeds", async () => {
  const api = handler({ valid: true });
  const response = await api.run({
    username: "fixture_user",
    password: "fixture-password",
  });
  assert.equal(api.passwordChecks(), 1);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    access_token: "fixture-access",
    refresh_token: "fixture-refresh",
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
test("lookup infrastructure failures do not pretend the account is missing", async () => {
  const response = await handler({
    lookupError: { message: "fixture failure" },
  }).run({ username: "fixture_user", password: "wrong" });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).access_token, undefined);
});

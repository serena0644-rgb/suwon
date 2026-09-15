import { readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const organizationSlug = process.env.SUPABASE_ORG_SLUG;
const dbPass = process.env.SUPABASE_DB_PASSWORD;
const projectName = process.env.SUPABASE_PROJECT_NAME || "suwon-dendeunpass";

if (!token || !organizationSlug || !dbPass) {
  console.error("Missing SUPABASE_ACCESS_TOKEN, SUPABASE_ORG_SLUG, or SUPABASE_DB_PASSWORD.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function request(path, options = {}) {
  const response = await fetch(`https://api.supabase.com/v1${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return body;
}

const created = await request("/projects", {
  method: "POST",
  body: JSON.stringify({
    name: projectName,
    organization_slug: organizationSlug,
    db_pass: dbPass,
    region_selection: "apac",
  }),
});

console.log(JSON.stringify({
  message: "Project creation requested. Wait until Supabase marks it ACTIVE, then run supabase/schema.sql in the SQL Editor.",
  projectRef: created.ref,
  projectId: created.id,
  dashboardUrl: `https://supabase.com/dashboard/project/${created.ref}`,
}, null, 2));

try {
  const schema = readFileSync("supabase/schema.sql", "utf8");
  console.log("\nCopy this SQL into Supabase SQL Editor after the project becomes ACTIVE:\n");
  console.log(schema);
} catch {
  // The SQL file is optional for this helper's project-creation step.
}

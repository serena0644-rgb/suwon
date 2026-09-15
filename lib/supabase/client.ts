"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "@/lib/env";

export function createClient() {
  const env = getSupabaseBrowserEnv();

  if (!env.configured) {
    return null;
  }

  return createBrowserClient(env.url, env.key);
}

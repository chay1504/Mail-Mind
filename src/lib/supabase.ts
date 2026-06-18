import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRuntimeConfig, requireEnv } from "./env";

let adminClient: SupabaseClient | null = null;
let browserClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return adminClient;
}

export function getSupabaseBrowser() {
  const config = getRuntimeConfig();

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  return browserClient;
}

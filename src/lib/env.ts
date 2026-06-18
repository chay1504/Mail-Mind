const optionalEnv = (name: string) => process.env[name]?.trim() || "";

export function getBaseUrl() {
  let url = optionalEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
  if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

export function requireEnv(name: string) {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getRuntimeConfig() {
  return {
    appUrl: getBaseUrl(),
    supabaseUrl: optionalEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: optionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: optionalEnv("SUPABASE_SERVICE_ROLE_KEY"),
    googleClientId: optionalEnv("GOOGLE_CLIENT_ID"),
    googleClientSecret: optionalEnv("GOOGLE_CLIENT_SECRET"),
    googleRedirectUri:
      optionalEnv("GOOGLE_REDIRECT_URI") ||
      `${getBaseUrl()}/api/auth/google/callback`,
    geminiApiKey: optionalEnv("GEMINI_API_KEY"),
    geminiModel: optionalEnv("GEMINI_MODEL") || "gemini-2.5-flash",
    geminiEmbeddingModel:
      optionalEnv("GEMINI_EMBEDDING_MODEL") || "text-embedding-004",
    nvidiaApiKey: optionalEnv("NVIDIA_API_KEY"),
    nvidiaModel: optionalEnv("NVIDIA_NIM_MODEL") || "meta/llama-3.1-8b-instruct",
    n8nWebhookBaseUrl:
      optionalEnv("N8N_WEBHOOK_BASE_URL") || "http://localhost:5678/webhook",
  };
}

export function assertServerReady() {
  const config = getRuntimeConfig();
  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", config.supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", config.supabaseServiceRoleKey],
  ].filter(([, value]) => !value);

  if (missing.length) {
    throw new Error(
      `Server is missing required config: ${missing.map(([name]) => name).join(", ")}`,
    );
  }
}

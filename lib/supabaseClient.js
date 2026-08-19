import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase env vars отсутствуют — заполните .env.local (локально) или Environment Variables в Vercel (на проде), затем пересоберите сайт."
  );
}

// createClient() throws on an empty/invalid URL, which would crash Next.js
// during build-time prerendering if the env vars aren't set yet. A valid
// placeholder URL keeps the build green; real requests will just fail with
// a normal, catchable error until the real keys are added.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);

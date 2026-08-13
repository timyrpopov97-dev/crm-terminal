import { createClient } from "@supabase/supabase-js";

// This client uses the SERVICE ROLE key, which bypasses Row Level Security.
// It must NEVER be imported into a "use client" component or exposed to the
// browser — only used inside server-side API routes.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const adminConfigured = Boolean(supabaseUrl && serviceKey);

export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  serviceKey || "placeholder-service-key",
  { auth: { persistSession: false } }
);

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase env vars отсутствуют — заполните .env.local (см. .env.local.example)"
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

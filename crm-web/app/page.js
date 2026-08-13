"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? "/board" : "/login");
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-term-muted text-sm relative z-10">
      booting terminal…
    </div>
  );
}

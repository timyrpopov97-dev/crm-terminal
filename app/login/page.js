"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "../../lib/supabaseClient";
import { Terminal } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo(
          "Готово! Если в настройках Supabase включено подтверждение почты — проверьте письмо. Иначе можно сразу войти."
        );
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/board");
      }
    } catch (err) {
      setError(err.message || "Неизвестная ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <div className="w-full max-w-sm border border-term-borderBright rounded-xl overflow-hidden bg-term-panel shadow-[0_0_50px_-8px_rgba(0,255,106,0.35)]">
        <div className="flex items-center gap-2 bg-black/40 px-3 py-2 border-b border-term-border text-xs text-term-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="ml-2">root@crm-terminal:~</span>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Terminal size={18} className="text-term-accent" />
            <span>ACCESS_TERMINAL</span>
            <span className="text-term-accent blink-cursor">▌</span>
          </div>
          <p className="text-xs text-term-muted mt-2">
            {mode === "login" ? "> введите email и пароль" : "> регистрация нового аккаунта"}
          </p>

          {!supabaseConfigured && (
            <div className="text-xs text-yellow-400 border border-yellow-400 bg-yellow-950/30 rounded-md px-3 py-2 mt-3">
              [!] Ключи Supabase не настроены. Проверьте .env.local (локально) или
              Environment Variables в Vercel → потом пересоберите сайт (Redeploy /
              npx vercel --prod).
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-3 mt-5">
            <label className="text-xs text-term-muted font-bold flex flex-col gap-1">
              EMAIL
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/40 border border-term-border rounded-md px-3 py-2 text-sm text-term-text focus:outline-none focus:border-term-accent"
                placeholder="you@example.com"
              />
            </label>
            <label className="text-xs text-term-muted font-bold flex flex-col gap-1">
              PASSWORD
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/40 border border-term-border rounded-md px-3 py-2 text-sm text-term-text focus:outline-none focus:border-term-accent"
                placeholder="минимум 6 символов"
              />
            </label>

            {error && (
              <div className="text-xs text-term-danger border border-term-danger bg-red-950/30 rounded-md px-3 py-2">
                ERROR: {error}
              </div>
            )}
            {info && (
              <div className="text-xs text-term-accent border border-term-accent bg-green-950/20 rounded-md px-3 py-2">
                {info}
              </div>
            )}

            <button
              disabled={busy}
              className="bg-term-accent text-black font-bold rounded-md py-2.5 text-sm mt-1 disabled:opacity-60"
            >
              {busy ? "ПОДКЛЮЧЕНИЕ…" : mode === "login" ? "$ ./login" : "$ ./register"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setInfo("");
            }}
            className="text-xs text-term-cyan mt-4"
          >
            {mode === "login" ? "нет аккаунта? зарегистрироваться →" : "уже есть аккаунт? войти →"}
          </button>
        </div>
      </div>
    </div>
  );
}

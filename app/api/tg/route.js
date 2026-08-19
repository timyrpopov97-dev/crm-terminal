import { NextResponse } from "next/server";
import { classifyLead } from "../../../lib/anthropic";
import { createClient } from "@supabase/supabase-js";

const CRITERIA =
  "Оптовый покупатель подсолнечного масла или пищевого сырья: маслоэкстракционные заводы, дистрибьюторы продуктов питания, производители майонеза/консервов/выпечки/фастфуда. НЕ подходят компании, чей профиль явно не связан с маслом.";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceKey && supabaseUrl
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  : null;

export async function POST(request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = await request.json();
    const message = update.channel_post || update.message;
    const text = message?.text  message?.caption  "";

    if (!text || text.trim().length < 5) {
      return NextResponse.json({ ok: true, skipped: "no text" });
    }

    console.log("[TG] Processing:", text.slice(0, 100));

    const result = await classifyLead(text, CRITERIA);

    if (!result.isMatch) {
      console.log("[TG] Skipped (not a match):", result.reasoning);
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (!supabase) {
      console.error("[TG] Supabase not configured");
      return NextResponse.json({ ok: true, warning: "Supabase not configured" });
    }

    const ownerId = process.env.LEADS_OWNER_USER_ID;
    if (!ownerId) {
      console.error("[TG] LEADS_OWNER_USER_ID not set");
      return NextResponse.json({ ok: true, warning: "Owner ID not configured" });
    }

    const { error } = await supabase.from("deals").insert({
      user_id: ownerId,
      name: result.companyName || "Лид из Telegram",
      company: result.companyName || "",
      phone: result.phone || "",
      email: "",
      amount: 0,
      description: [Авто-лид] ${result.reasoning}\n\nСообщение:\n${text}.slice(0, 2000),
      currency: "UAH",
      stage: "lead",
      source: "telegram",
    });

    if (error) {
      console.error("[TG] DB error:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    console.log("[TG] Lead added:", result.companyName);
    return NextResponse.json({ ok: true, added: result.companyName });
  } catch (e) {
    console.error("[TG] Error:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "Telegram webhook is alive" });
}

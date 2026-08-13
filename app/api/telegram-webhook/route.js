import { NextResponse } from "next/server";
import { supabaseAdmin, adminConfigured } from "../../../lib/supabaseAdmin";
import { classifyLead } from "../../../lib/anthropic";

// Edit this to match what you're actually selling. Be specific — the more
// precise the criteria, the better the AI filters out irrelevant companies.
const CRITERIA =
  "Оптовый покупатель подсолнечного масла или пищевого сырья/жиров: " +
  "маслоэкстракционные заводы, дистрибьюторы продуктов питания, " +
  "производители майонеза/консервов/выпечки/фастфуда, экспортёры " +
  "растительных масел и похожие компании. НЕ подходят компании, чей " +
  "профиль явно не связан с маслом (например, только мороженое, " +
  "напитки, непищевые товары), если в тексте прямо не сказано, что им " +
  "нужно масло или похожее сырьё.";

export async function POST(request) {
  // Optional shared-secret check so random people can't POST fake leads
  // into your CRM. Set TELEGRAM_WEBHOOK_SECRET and pass the same value
  // as secret_token when calling Telegram's setWebhook.
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  куплю 20 тонн подсолнечного масла ТОВ Агропродукт
  }
  const ownerId = process.env.LEADS_OWNER_USER_ID;
  if (!ownerId) {
    return NextResponse.json(
      { ok: false, error: "LEADS_OWNER_USER_ID не настроен" },
      { status: 500 }
    );
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const message = update.channel_post || update.message;
  const text = message?.text || message?.caption;

  if (!text || text.trim().length < 8) {
    return NextResponse.json({ ok: true, skipped: "no usable text" });
  }

  try {
    const result = await classifyLead(text, CRITERIA);

    if (!result.isMatch) {
      return NextResponse.json({ ok: true, skipped: true, reasoning: result.reasoning });
    }

    const { error } = await supabaseAdmin.from("deals").insert({
      user_id: ownerId,
      name: result.companyName || "Лид из Telegram",
      company: result.companyName || "",
      phone: result.phone || "",
      email: "",
      amount: 0,
      description: `[Авто-лид из Telegram] ${result.reasoning}\n\nИсходное сообщение:\n${text}`.slice(0, 2000),
      currency: "UAH",
      stage: "lead",
      source: "telegram",
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, added: result.companyName || "(без названия)" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// Simple health check — open this URL in a browser to confirm it's deployed.
export async function GET() {
  return NextResponse.json({ ok: true, info: "Telegram lead webhook is alive. Use POST for real updates." });
}


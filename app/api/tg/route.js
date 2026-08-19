import { NextResponse } from "next/server";
import { classifyLead } from "../../../lib/anthropic";
import { createClient } from "@supabase/supabase-js";

const CRITERIA = "Sunflower oil wholesale buyers, food distributors, manufacturers: factories, oil extractors, mayonnaise/canned/baking/fast food producers. Exclude companies with no food connection unless they explicitly request oil or similar products.";

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
    const text = message?.text || message?.caption || "";

    if (!text || text.trim().length < 5) {
      return NextResponse.json({ ok: true, skipped: "no text" });
    }

    console.log("[TG] Message:", text.slice(0, 100));

    const result = await classifyLead(text, CRITERIA);

    if (!result.isMatch) {
      console.log("[TG] Not a match:", result.reasoning);
      return NextResponse.json({ ok: true, skipped: true, reason: result.reasoning });
    }

    if (!supabase) {
      console.error("[TG] Supabase not configured");
      return NextResponse.json({ ok: true, warning: "Supabase not ready" });
    }

    const ownerId = process.env.LEADS_OWNER_USER_ID;
    if (!ownerId) {
      console.error("[TG] No owner ID");
      return NextResponse.json({ ok: true, warning: "Owner ID missing" });
    }

    const { error } = await supabase.from("deals").insert({
      user_id: ownerId,
      name: result.companyName || "Lead from Telegram",
      company: result.companyName || "",
      phone: result.phone || "",
      email: "",
      amount: 0,
      description: `[Auto-lead] ${result.reasoning}\n\nMessage:\n${text}`.slice(0, 2000),
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

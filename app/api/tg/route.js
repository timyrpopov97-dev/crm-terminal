import { NextResponse } from "next/server";

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

    console.log("[TG] Message received:", text.slice(0, 100));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[TG] Error:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "Telegram webhook is alive" });
}

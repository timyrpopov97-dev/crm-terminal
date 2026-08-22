import { NextResponse } from "next/server";
import { classifyLead } from "../../../lib/anthropic";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const CRITERIA = "Sunflower oil wholesale buyers, food distributors, manufacturers: factories, oil extractors, mayonnaise/canned/baking/fast food producers. Exclude companies with no food connection unless they explicitly request oil or similar products.";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceKey && supabaseUrl
? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
: null;

function extractEmail(text) {
const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
const match = text.match(emailRegex);
return match ? match[0] : "";
}

function extractName(text) {
const match = text.match(/(?:меня зовут|мне зовут|я\s+)([а-яА-ЯёЁ\s\-]+?)(?:\.|,|$)/i);
if (match && match[1]) {
return match[1].trim();
}

const nameMatch = text.match(/^([а-яА-ЯёЁ]+\s+[а-яА-ЯёЁ]+)/);
if (nameMatch) return nameMatch[1];

return "";
}

function extractPhone(text) {
const phoneRegex = /(\+?[0-9]{1,3}[\s\-]?[\(]?[0-9]{2,4}[\)]?[\s\-]?[0-9]{2,4}[\s\-]?[0-9]{2,4})/;
const match = text.match(phoneRegex);
return match ? match[0] : "";
}

function extractUsername(text) {
const usernameRegex = /@([a-zA-Z0-9_]{5,32})/;
const match = text.match(usernameRegex);
return match ? match[1] : "";
}

function generateMessageHash(text) {
return crypto.createHash("md5").update(text).digest("hex");
}

export async function POST(request) {
const secret = request.headers.get("x-telegram-bot-api-secret-token");
if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
return NextResponse.json({ ok: false }, { status: 401 });
}

try {
const update = await request.json();
const message = update.channel_post || update.message;
const text = message?.text || message?.caption || "";
const fromUsername = message?.from?.username || "";
const fromId = message?.from?.id || "";
const messageId = message?.message_id || "";

if (!text || text.trim().length < 5) {
return NextResponse.json({ ok: true, skipped: "no text" });
}

console.log("[TG] Message:", text.slice(0, 100));

// Проверяем дубликаты по хешу сообщения
const messageHash = generateMessageHash(text);
const ownerId = process.env.LEADS_OWNER_USER_ID;

if (supabase && ownerId) {
const { data: existingLead } = await supabase
.from("deals")
.select("id")
.eq("user_id", ownerId)
.eq("source", "telegram")
.ilike("description", `%${messageHash}%`)
.limit(1)
.single();

if (existingLead) {
console.log("[TG] Duplicate message, skipping");
return NextResponse.json({ ok: true, skipped: "duplicate message" });
}
}

const result = await classifyLead(text, CRITERIA);

if (!result.isMatch) {
console.log("[TG] Not a match:", result.reasoning);
return NextResponse.json({ ok: true, skipped: true, reason: result.reasoning });
}

if (!supabase) {
console.error("[TG] Supabase not configured");
return NextResponse.json({ ok: true, warning: "Supabase not ready" });
}

if (!ownerId) {
console.error("[TG] No owner ID");
return NextResponse.json({ ok: true, warning: "Owner ID missing" });
}

const email = extractEmail(text);
const phone = extractPhone(text);
const username = extractUsername(text) || fromUsername;
const name = extractName(text) || result.companyName || "Lead from Telegram";

let telegramLink = "";
if (username) {
telegramLink = `https://t.me/${username}`;
} else if (fromId) {
telegramLink = `https://t.me/${fromId}`;
}

const description = `[Auto-lead] ${result.reasoning}

**Оригинальное сообщение:**
${text}

${telegramLink ? `**➜ Написать в Telegram:** ${telegramLink}` : "❌ Контакты не найдены - проверьте историю чата"}

---
Hash: ${messageHash}`;

const descriptionTrimmed = description.length > 2000 ? description.slice(0, 1997) + "..." : description;

const { error } = await supabase.from("deals").insert({
user_id: ownerId,
name: name,
company: result.companyName || "",
phone: phone || "",
email: email || "",
amount: 0,
description: descriptionTrimmed,
currency: "UAH",
stage: "lead",
source: "telegram",
});

if (error) {
console.error("[TG] DB error:", error.message);
return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
}

console.log("[TG] Lead added:", name);
return NextResponse.json({ ok: true, added: name });
} catch (e) {
console.error("[TG] Error:", e.message);
return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
}
}

export async function GET() {
return NextResponse.json({ ok: true, info: "Telegram webhook is alive" });
}

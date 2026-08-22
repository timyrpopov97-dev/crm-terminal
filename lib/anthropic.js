const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

export async function classifyLead(text, criteria) {
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
throw new Error("ANTHROPIC_API_KEY not set");
}

const prompt = `You are a B2B lead classifier. Analyze this message.

Criteria for a qualified lead:
${criteria}

Message from trading chat:
"""
${text}
"""

Determine:
1. Is a specific company/buyer mentioned?
2. Does it match the criteria?

Respond ONLY in JSON format, no explanation:
{"isMatch": true/false, "companyName": "name or null", "phone": "phone or null", "reasoning": "short reason in English"}`;

const res = await fetch(ANTHROPIC_API_URL, {
method: "POST",
headers: {
"content-type": "application/json",
"x-api-key": apiKey,
"anthropic-version": "2023-06-01",
},
body: JSON.stringify({
model: MODEL,
max_tokens: 300,
messages: [{ role: "user", content: prompt }],
}),
});

if (!res.ok) {
const errText = await res.text();
throw new Error(`API error ${res.status}`);
}

const data = await res.json();
const textBlock = (data.content || []).find((c) => c.type === "text");
if (!textBlock) throw new Error("Empty response");

const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
return JSON.parse(cleaned);
}

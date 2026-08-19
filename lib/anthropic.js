const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

export async function classifyLead(text, criteria) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY не настроен");
  }

  const prompt = `Ты помогаешь отбирать лиды.

Критерий подходящего клиента:
${criteria}

Вот сообщение из торгового чата:
"""
${text}
"""

Определи:
1. Упомянута ли конкретная компания/покупатель?
2. Подходит ли под критерий?

Ответь ТОЛЬКО JSON, без пояснений:
{"isMatch": true/false, "companyName": "название или null", "phone": "телефон или null", "reasoning": "короткая фраза на русском"}`;

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
    throw new Error(`API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((c) => c.type === "text");
  if (!textBlock) throw new Error("Пустой ответ от модели");

  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Не удалось разобрать ответ: " + cleaned.slice(0, 200));
  }
}

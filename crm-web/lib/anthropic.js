const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

/**
 * Asks Claude whether a raw text (e.g. a Telegram trading-group post)
 * mentions a company that plausibly matches the given buying criteria.
 * Returns { isMatch, companyName, phone, reasoning }.
 */
export async function classifyLead(text, criteria) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY не настроен в переменных окружения");
  }

  const prompt = `Ты помогаешь отделу продаж отбирать входящие лиды из потока сообщений.

Критерий подходящего клиента:
${criteria}

Вот сырое сообщение (например, из торгового Telegram-чата или экспортного хаба):
"""
${text}
"""

Определи:
1. Упоминается ли в сообщении конкретная компания/покупатель (не просто общий пост без названия)?
2. Подходит ли эта компания под критерий выше — то есть могла бы она реально быть покупателем? Если профиль компании явно не связан с критерием (например, торгует мороженым, а критерий — масло) и в тексте нет прямого запроса на этот товар — считай, что НЕ подходит.

Если название компании явно не указано, но есть явный запрос ("нужен покупатель подсолнечного масла, объём 20 тонн") — можно засчитать как match с companyName: null, это тоже полезный лид.

Ответь СТРОГО в формате JSON, без пояснений вокруг, без markdown:
{"isMatch": true, "companyName": "название или null", "phone": "телефон если есть в тексте, иначе null", "reasoning": "одна короткая фраза на русском, почему да/нет"}`;

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
    throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((c) => c.type === "text");
  if (!textBlock) throw new Error("Пустой ответ от модели");

  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Не удалось разобрать ответ модели как JSON: " + cleaned.slice(0, 200));
  }
}

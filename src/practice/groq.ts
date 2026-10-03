// Server-only — imported only from src/app/api/practice/* route handlers, never from a "use
// client" component, so GROQ_API_KEY never reaches the browser bundle.
// Groq's model lineup changes over time — "llama-3.3-70b-versatile" is no longer available on
// this account as of testing; verified this one actually works via a live request instead of
// guessing from stale docs.
const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class GroqNotConfiguredError extends Error {}

export async function callGroq(messages: GroqMessage[], jsonMode = false): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqNotConfiguredError("GROQ_API_KEY is not set — add it to .env.local to enable Practice mode.");
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq API request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Groq API returned an unexpected response shape.");
  }
  return content;
}

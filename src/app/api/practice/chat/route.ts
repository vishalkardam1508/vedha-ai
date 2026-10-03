import { NextResponse } from "next/server";
import { callGroq, GroqNotConfiguredError, type GroqMessage } from "@/practice/groq";
import { buildChatSystemPrompt } from "@/practice/prompts";
import { MAX_PRACTICE_QUESTIONS } from "@/practice/constants";
import type { JdDetails, PracticeMessage, PracticeMode, TechnicalTopic } from "@/practice/types";

interface ChatRequestBody {
  mode: PracticeMode;
  topics: TechnicalTopic[];
  jd?: JdDetails;
  messages: PracticeMessage[];
  questionNumber: number;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { mode, topics, jd, messages, questionNumber } = body;
  if (mode !== "english" && mode !== "technical" && mode !== "jd") {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages must be an array." }, { status: 400 });
  }
  if (mode === "jd" && !jd?.jobDescription?.trim()) {
    return NextResponse.json({ error: "A job description is required for this mode." }, { status: 400 });
  }

  // The system prompt is always built server-side from a trusted mode/topics/jd value — the
  // client only ever supplies the conversation history, never the instructions themselves.
  const groqMessages: GroqMessage[] = [
    {
      role: "system",
      content: buildChatSystemPrompt(mode, topics ?? [], questionNumber || 1, MAX_PRACTICE_QUESTIONS, jd),
    },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const reply = await callGroq(groqMessages);
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("[api/practice/chat] Groq request failed:", err);
    return NextResponse.json({ error: "Failed to reach the practice AI. Please try again." }, { status: 502 });
  }
}

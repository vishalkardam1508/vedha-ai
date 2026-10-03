import { NextResponse } from "next/server";
import { callGroq, GroqNotConfiguredError, type GroqMessage } from "@/practice/groq";
import type { JdDetails } from "@/practice/types";

interface EligibilityRequestBody {
  jd: JdDetails;
}

interface EligibilityResult {
  eligible: boolean;
  score: number;
  reason: string;
}

function isValidEligibility(data: unknown): data is EligibilityResult {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return typeof d.eligible === "boolean" && typeof d.score === "number" && typeof d.reason === "string";
}

function buildEligibilitySystemPrompt(): string {
  return (
    "You are an ATS-style screener comparing a candidate's resume against a job description before a " +
    "mock interview begins. Be realistic and reasonably strict — this check exists to tell candidates " +
    "up front whether they're a plausible fit, not to be encouraging regardless of content.\n\n" +
    "Respond with ONLY a JSON object in exactly this shape, no markdown fences, no commentary:\n" +
    '{"eligible": true or false, "score": 0-100 overall fit, "reason": "1-2 sentence explanation citing ' +
    'specific matched or missing requirements"}\n\n' +
    "Set \"eligible\" to false only when the resume shows a clear, substantial mismatch with the job's " +
    "core requirements (wrong field entirely, missing must-have skills/technologies the JD explicitly " +
    "requires, or experience far below what's asked for). Minor gaps, a slightly different tech stack " +
    "that's still closely related, or normal seniority differences should still be \"eligible\": true — " +
    "give the benefit of the doubt unless the mismatch is obvious and significant."
  );
}

export async function POST(request: Request) {
  let body: EligibilityRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { jd } = body;
  if (!jd?.jobDescription?.trim() || !jd?.resumeText?.trim()) {
    return NextResponse.json({ error: "Both a job description and a resume are required for this check." }, { status: 400 });
  }

  const userContent =
    `Job description (${jd.company || "the company"}, ${jd.experience || "unspecified"} years experience expected):\n` +
    `${jd.jobDescription}\n\nCandidate's resume:\n${jd.resumeText}`;

  const groqMessages: GroqMessage[] = [
    { role: "system", content: buildEligibilitySystemPrompt() },
    { role: "user", content: userContent },
  ];

  try {
    const raw = await callGroq(groqMessages, true);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Can't parse a verdict — fail open rather than blocking practice on a formatting hiccup.
      return NextResponse.json({ result: { eligible: true, score: 50, reason: "" } });
    }
    if (!isValidEligibility(parsed)) {
      return NextResponse.json({ result: { eligible: true, score: 50, reason: "" } });
    }
    return NextResponse.json({ result: parsed });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("[api/practice/eligibility] Groq request failed:", err);
    return NextResponse.json({ error: "Failed to check resume fit. Please try again." }, { status: 502 });
  }
}

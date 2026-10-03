import { NextResponse } from "next/server";
import { callGroq, GroqNotConfiguredError, type GroqMessage } from "@/practice/groq";
import { buildReportSystemPrompt } from "@/practice/prompts";
import type { JdDetails, PracticeMessage, PracticeMode, PracticeReportData, PracticeResumeMatch } from "@/practice/types";

interface ReportRequestBody {
  mode: PracticeMode;
  jd?: JdDetails;
  messages: PracticeMessage[];
}

function isValidResumeMatch(data: unknown): data is PracticeResumeMatch {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.score === "number" &&
    Array.isArray(d.matchedSkills) &&
    Array.isArray(d.missingSkills) &&
    typeof d.notes === "string"
  );
}

function isValidReport(data: unknown): data is PracticeReportData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (typeof d.summary !== "string" || !Array.isArray(d.corrections) || !Array.isArray(d.improvements)) return false;
  // resumeMatch is optional — if the model included something malformed there, drop just that
  // field rather than failing the whole report.
  if (d.resumeMatch !== undefined && !isValidResumeMatch(d.resumeMatch)) delete d.resumeMatch;
  return true;
}

export async function POST(request: Request) {
  let body: ReportRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { mode, jd, messages } = body;
  if (mode !== "english" && mode !== "technical" && mode !== "jd") {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No conversation to report on." }, { status: 400 });
  }

  const header =
    mode === "jd" && jd
      ? `Job description (${jd.company || "the company"}, ${jd.experience || "unspecified"} experience):\n${jd.jobDescription}\n\n` +
        (jd.resumeText ? `Candidate's resume:\n${jd.resumeText}\n\n` : "") +
        "Transcript:\n"
      : "";
  const transcript =
    header + messages.map((m) => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`).join("\n");
  const groqMessages: GroqMessage[] = [
    { role: "system", content: buildReportSystemPrompt(mode, jd) },
    { role: "user", content: transcript },
  ];

  try {
    const raw = await callGroq(groqMessages, true);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // The model didn't return valid JSON — fall back to showing its raw text as the summary
      // rather than failing the whole report.
      const fallback: PracticeReportData = { summary: raw, corrections: [], improvements: [] };
      return NextResponse.json({ report: fallback });
    }
    if (!isValidReport(parsed)) {
      const fallback: PracticeReportData = { summary: raw, corrections: [], improvements: [] };
      return NextResponse.json({ report: fallback });
    }
    return NextResponse.json({ report: parsed });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("[api/practice/report] Groq request failed:", err);
    return NextResponse.json({ error: "Failed to generate the report. Please try again." }, { status: 502 });
  }
}

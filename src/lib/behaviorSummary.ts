import type { BodyLogEntry } from "@/hooks/useBehaviorLog";

export interface QuestionBehaviorSummary {
  label: "Not enough data" | "Calm & confident" | "Some tension" | "Signs of stress";
  stressRatio: number; // 0..1, informational only
}

const STRESS_EXPRESSIONS = new Set(["frowning", "sad", "squinting"]);

// A made-up composite heuristic from signals already logged elsewhere (posture shifts, gaze
// aversion, tense-looking expressions) — NOT a validated psychological measure of confidence
// or stress. Treat it as a rough conversation-starter, not a scored assessment of the candidate.
export function summarizeQuestionBehavior(entries: BodyLogEntry[]): QuestionBehaviorSummary {
  if (entries.length === 0) return { label: "Not enough data", stressRatio: 0 };

  const stressHits = entries.filter(
    (e) => e.postureShift || e.lookingAway || STRESS_EXPRESSIONS.has(e.expression)
  ).length;
  const stressRatio = stressHits / entries.length;

  const label: QuestionBehaviorSummary["label"] =
    stressRatio < 0.2 ? "Calm & confident" : stressRatio < 0.5 ? "Some tension" : "Signs of stress";

  return { label, stressRatio };
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { MAX_PRACTICE_QUESTIONS } from "./constants";
import type {
  JdDetails,
  PracticeMessage,
  PracticeMode,
  PracticeReportData,
  PracticeScorecardEntry,
  PracticeScreen,
  TechnicalTopic,
} from "./types";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Something went wrong.");
  return data;
}

const SCORE_TAG = /^\[\[SCORE:(\d{1,2})\]\]\s*/;

// "jd" mode replies (after the first) start with a [[SCORE:n]] tag rating the candidate's
// previous answer — pulled out here so it never reaches speech, captions, or the transcript,
// and stored on the message instead for the scorecard.
function parseScoreTag(raw: string): { content: string; score?: number } {
  const match = raw.match(SCORE_TAG);
  if (!match) return { content: raw };
  const score = Math.max(1, Math.min(10, parseInt(match[1], 10)));
  return { content: raw.slice(match[0].length).trim(), score };
}

export function usePracticeSession() {
  const [screen, setScreen] = useState<PracticeScreen>("setup");
  const [mode, setMode] = useState<PracticeMode | null>(null);
  const [topics, setTopics] = useState<TechnicalTopic[]>([]);
  const [jdDetails, setJdDetails] = useState<JdDetails | null>(null);
  const [messages, setMessages] = useState<PracticeMessage[]>([]);
  const [report, setReport] = useState<PracticeReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // One "question" == one assistant message. Capped so a session can't run forever.
  const questionCount = messages.filter((m) => m.role === "assistant").length;

  // "jd" mode only — pairs each candidate answer with the score Veda gave it and the question
  // that prompted it (the assistant message immediately before that answer).
  const scorecard = useMemo<PracticeScorecardEntry[]>(() => {
    const entries: PracticeScorecardEntry[] = [];
    for (let i = 1; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== "assistant" || m.score === undefined) continue;
      const answer = messages[i - 1];
      const question = messages[i - 2];
      if (answer?.role !== "user") continue;
      entries.push({ question: question?.content ?? "Introduce yourself", answer: answer.content, score: m.score });
    }
    return entries;
  }, [messages]);

  const generateReport = useCallback(
    async (finalMode: PracticeMode, finalMessages: PracticeMessage[]) => {
      setScreen("loading-report");
      setError(null);
      try {
        const data = await postJSON<{ report: PracticeReportData }>("/api/practice/report", {
          mode: finalMode,
          jd: finalMode === "jd" ? jdDetails ?? undefined : undefined,
          messages: finalMessages,
        });
        setReport(data.report);
        setScreen("report");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setScreen("chatting");
      }
    },
    [jdDetails]
  );

  const start = useCallback(
    async (selectedMode: PracticeMode, selectedTopics: TechnicalTopic[], selectedJd?: JdDetails) => {
      setError(null);

      // Practice mode never calls getUserMedia elsewhere (unlike the real proctored interview,
      // where PermissionsStep grants mic access upfront) — SpeechRecognition would otherwise be
      // the very first thing to ever request the microphone, and it does so later from a timer
      // callback (3s after Veda finishes speaking), not a direct click. On a fresh origin most
      // browsers silently fail or never prompt for a permission request that isn't tied to a
      // user gesture, so recognition.start() looks like it's "listening" but never actually
      // captures anything. Requesting it here — inside the Start button's own click handler —
      // gets a real permission prompt in front of the user before the session begins, and lets
      // us surface a clear error immediately if they deny it instead of a silent dead mic later.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Voice input isn't supported in this browser — try Chrome or Edge over HTTPS.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        setError("Microphone access is required for Practice mode. Please allow it and try again.");
        return;
      }

      setMode(selectedMode);
      setTopics(selectedTopics);
      setJdDetails(selectedMode === "jd" ? selectedJd ?? null : null);
      setMessages([]);
      setSending(true);
      try {
        const data = await postJSON<{ reply: string }>("/api/practice/chat", {
          mode: selectedMode,
          topics: selectedTopics,
          jd: selectedMode === "jd" ? selectedJd : undefined,
          messages: [],
          questionNumber: 1,
        });
        const { content } = parseScoreTag(data.reply);
        setMessages([{ role: "assistant", content }]);
        setScreen("chatting");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setSending(false);
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!mode || sending) return;
      const nextMessages: PracticeMessage[] = [...messages, { role: "user", content: text }];
      setMessages(nextMessages);

      // That answer was for the last allotted question — wrap up instead of asking for one
      // more. A backstop independent of whether the model itself actually stopped on cue.
      if (questionCount >= MAX_PRACTICE_QUESTIONS) {
        await generateReport(mode, nextMessages);
        return;
      }

      setSending(true);
      setError(null);
      try {
        const data = await postJSON<{ reply: string }>("/api/practice/chat", {
          mode,
          topics,
          jd: mode === "jd" ? jdDetails : undefined,
          messages: nextMessages,
          questionNumber: questionCount + 1,
        });
        const { content, score } = parseScoreTag(data.reply);
        setMessages((prev) => [...prev, { role: "assistant", content, score }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setSending(false);
      }
    },
    [mode, topics, jdDetails, messages, sending, questionCount, generateReport]
  );

  const finish = useCallback(() => {
    if (!mode) return;
    generateReport(mode, messages);
  }, [mode, messages, generateReport]);

  const reset = useCallback(() => {
    setScreen("setup");
    setMode(null);
    setTopics([]);
    setJdDetails(null);
    setMessages([]);
    setReport(null);
    setError(null);
  }, []);

  return {
    screen,
    mode,
    topics,
    jdDetails,
    messages,
    scorecard,
    report,
    error,
    sending,
    questionCount,
    maxQuestions: MAX_PRACTICE_QUESTIONS,
    start,
    sendMessage,
    finish,
    reset,
  };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useInterviewerVoice } from "@/hooks/useInterviewerVoice";
import { useVoiceSyncedText } from "@/hooks/useVoiceSyncedText";
import { InterviewerAvatar, type AvatarState } from "@/components/InterviewerAvatar";
import { usePracticeVoiceInput } from "./usePracticeVoiceInput";
import type { PracticeMessage } from "./types";

interface PracticeChatProps {
  messages: PracticeMessage[];
  sending: boolean;
  error: string | null;
  questionCount: number;
  maxQuestions: number;
  onSend: (text: string) => void;
  onFinish: () => void;
}

type VoicePhase = "speaking" | "listening" | "waiting";

export function PracticeChat({ messages, sending, error, questionCount, maxQuestions, onSend, onFinish }: PracticeChatProps) {
  const interviewerVoice = useInterviewerVoice();
  const voiceInput = usePracticeVoiceInput();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const lastSpokenIndexRef = useRef(-1);
  const [phase, setPhase] = useState<VoicePhase>("waiting");

  // Speak each new assistant message exactly once. useInterviewerVoice holds for 3s after she
  // finishes (its default holdAfterSpeechMs) before calling onEnded — listening then starts
  // automatically at that point. Only *stopping* (done answering) is a manual button press.
  useEffect(() => {
    if (sending) return;
    const lastIndex = messages.length - 1;
    if (lastIndex < 0) return;
    const last = messages[lastIndex];
    if (last.role !== "assistant" || lastSpokenIndexRef.current === lastIndex) return;
    lastSpokenIndexRef.current = lastIndex;

    setPhase("speaking");
    interviewerVoice.speak(last.content, () => {
      voiceInput.start();
      setPhase("listening");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, sending]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, voiceInput.transcript]);

  // A recognition failure (mic permission revoked mid-session, service outage, ...) would
  // otherwise leave phase stuck on "listening" forever with nothing being captured — the mic
  // button stays lit but never picks up a word. Drop back to idle so the error box is visible
  // and the candidate can see something actually went wrong instead of just talking to nothing.
  useEffect(() => {
    if (voiceInput.error && phase === "listening") setPhase("waiting");
  }, [voiceInput.error, phase]);

  useEffect(
    () => () => {
      interviewerVoice.stop();
      voiceInput.stop();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function handleStopAnswering() {
    if (phase !== "listening") return;
    const text = voiceInput.transcript.trim();
    voiceInput.stop();
    if (!text) {
      // Nothing said yet — keep the mic open rather than leaving it silently stopped.
      voiceInput.start();
      return;
    }
    setPhase("waiting");
    onSend(text);
  }

  const avatarState: AvatarState = phase === "speaking" ? "speaking" : phase === "listening" ? "listening" : "idle";
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  // Reveals lastAssistantMessage word-by-word in step with the real audio timeline — the exact
  // same hook and mechanism the real interview uses for Veda's captions, instead of just
  // flashing the whole sentence on screen the instant she starts talking.
  const typedCaption = useVoiceSyncedText({
    text: lastAssistantMessage,
    active: phase === "speaking",
    voiceState: interviewerVoice.state,
    progressRef: interviewerVoice.progressRef,
  });
  const captionText =
    phase === "listening"
      ? voiceInput.transcript || "Listening…"
      : phase === "speaking"
      ? typedCaption
      : sending
      ? "…"
      : lastAssistantMessage;

  return (
    <div className="practice-session-layout">
      {/* Avatar + question — 70% */}
      <div className="practice-session-main">
        <div className="badge">
          <span className="dot" /> Question {Math.min(questionCount, maxQuestions)} of {maxQuestions}
        </div>
        <InterviewerAvatar state={avatarState} hideMeta />
        <p className="practice-question-text">
          {captionText}
          {phase === "speaking" && <span className="nova-caret" />}
        </p>

        {(error || voiceInput.error) && (
          <div className="error-box" style={{ marginTop: "0.5rem" }}>
            <i className="ti ti-alert-triangle" /> {error || voiceInput.error}
          </div>
        )}

        <div className="practice-voice-status">
          {sending ? "Veda is thinking…" : phase === "speaking" ? "Veda is speaking…" : "Listening — tap to stop"}
        </div>

        <button
          type="button"
          className={`practice-mic-btn${phase === "listening" ? " practice-mic-btn--active" : ""}`}
          onClick={handleStopAnswering}
          disabled={phase !== "listening"}
        >
          <i className={`ti ${phase === "listening" ? "ti-player-stop-filled" : "ti-microphone"}`} />
        </button>

        <button
          className="btn-outline"
          style={{ marginTop: "1.5rem" }}
          onClick={onFinish}
          disabled={sending || messages.length === 0}
        >
          <i className="ti ti-flag-check" /> Finish & Get Report
        </button>
      </div>

      {/* Conversation — 30%, right side, floating card */}
      <div className="practice-session-conversation">
        <div className="practice-stage-transcript-label">
          <i className="ti ti-message-circle" /> Conversation
        </div>
        <div className="practice-session-messages" ref={transcriptRef}>
          {messages.map((m, i) => (
            <div key={i} className={`practice-bubble practice-bubble--${m.role}`}>
              {m.score !== undefined && (
                <span className="practice-score-badge">
                  <i className="ti ti-star-filled" /> {m.score}/10
                </span>
              )}
              <div>{m.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

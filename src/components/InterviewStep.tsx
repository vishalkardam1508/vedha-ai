"use client";

import { useState, useEffect, useRef } from "react";
import { novaIntro, TRANSITION_PHRASES, MAX_STRIKES } from "@/lib/constants";
import { formatTime, captureVideoSnapshot } from "@/lib/utils";
import { useQuestionRecorder } from "@/hooks/useQuestionRecorder";
import { useTimer } from "@/hooks/useTimer";
import { useInterviewerVoice, type VoicePreset } from "@/hooks/useInterviewerVoice";
import { useVoiceSyncedText } from "@/hooks/useVoiceSyncedText";
import { useFaceMonitor } from "@/hooks/useFaceMonitor";
import { useObjectMonitor } from "@/hooks/useObjectMonitor";
import { useBackgroundMonitor } from "@/hooks/useBackgroundMonitor";
import { useBehaviorLog, type BodyLogEntry } from "@/hooks/useBehaviorLog";
import { InterviewerAvatar, type AvatarState } from "@/components/InterviewerAvatar";
import { FullscreenTakeover } from "@/components/FullscreenTakeover";
import type { QuestionRecording, Warning, WarningType } from "@/types";

interface InterviewStepProps {
  interviewTitle: string;
  questions: string[];
  screenStream: MediaStream;
  webcamStream: MediaStream;
  micStream: MediaStream;
  warnings: Warning[];
  tabChanges: number;
  onSubmit: (recordings: QuestionRecording[]) => void;
  onSimulateWarning: () => void;
  disqualified: boolean;
  disqualifyMessage: string;
  onDisqualify: (recordings: QuestionRecording[]) => void;
  onVisionWarning: (type: WarningType, message: string, timestamp: string) => void;
  onBodyLogEntry: (entry: BodyLogEntry) => void;
  onWarningSnapshot: (index: number, snapshot: string) => void;
  voicePreset: VoicePreset;
}

type NovaPhase = "ready" | "intro" | "asking" | "listening" | "saving";

const READY_COUNTDOWN_SECONDS = 10;
const READY_RING_RADIUS = 54;
const READY_RING_CIRCUMFERENCE = 2 * Math.PI * READY_RING_RADIUS;

function speakBrowserAnnouncement(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

export function InterviewStep({
  interviewTitle,
  questions,
  screenStream,
  webcamStream,
  micStream,
  warnings,
  tabChanges,
  onSubmit,
  onSimulateWarning,
  disqualified,
  disqualifyMessage,
  onDisqualify,
  onVisionWarning,
  onBodyLogEntry,
  onWarningSnapshot,
  voicePreset,
}: InterviewStepProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [recordings, setRecordings] = useState<QuestionRecording[]>([]);
  const [novaPhase, setNovaPhase] = useState<NovaPhase>("ready");
  const [readySecondsLeft, setReadySecondsLeft] = useState(READY_COUNTDOWN_SECONDS);
  const [showWarningOverlay, setShowWarningOverlay] = useState(false);
  // The browser will not let a website preventDefault() the Esc key's built-in "exit
  // fullscreen" behavior — that's a deliberate web-platform safeguard so no site can ever
  // trap a user in fullscreen. The workaround every proctoring tool actually uses: detect the
  // exit immediately and block the rest of the UI behind a takeover until the candidate
  // clicks a real button to re-enter fullscreen (a genuine click is required for
  // requestFullscreen() to succeed reliably — a non-gesture call from an event handler is not).
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== "undefined" && !!document.fullscreenElement
  );
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const advancingRef = useRef(false);
  const disqualifyingRef = useRef(false);
  const prevWarningCountRef = useRef(warnings.length);
  const disqualifiedRef = useRef(disqualified);
  disqualifiedRef.current = disqualified;
  const onWarningSnapshotRef = useRef(onWarningSnapshot);
  onWarningSnapshotRef.current = onWarningSnapshot;

  const { elapsed, reset: resetTimer } = useTimer(novaPhase === "listening");

  const { startRecording, stopRecording, transcript, isListening } = useQuestionRecorder({
    screenStream,
    webcamStream,
    micStream,
    systemAudioStream: null, // system audio comes through screenStream
  });

  const interviewerVoice = useInterviewerVoice(3000, voicePreset);

  const { status: faceStatus } = useFaceMonitor({
    active: !disqualified,
    videoRef: webcamVideoRef,
    onViolation: onVisionWarning,
  });

  const { status: objectStatus } = useObjectMonitor({
    active: !disqualified,
    videoRef: webcamVideoRef,
    onViolation: onVisionWarning,
  });

  const { status: backgroundStatus } = useBackgroundMonitor({
    active: !disqualified,
    videoRef: webcamVideoRef,
    onViolation: onVisionWarning,
  });

  useBehaviorLog({
    active: !disqualified,
    questionIndex: currentQ,
    videoRef: webcamVideoRef,
    onLogEntry: onBodyLogEntry,
  });

  // Mount webcam preview
  useEffect(() => {
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = webcamStream;
    }
  }, [webcamStream]);

  // Tracks real fullscreen state so the takeover below can gate the whole UI immediately on
  // exit (Esc included) and lift the instant the candidate actually returns — not on a timer.
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function beginListening() {
    startRecording();
    setNovaPhase("listening");
  }

  // A short "get ready" countdown before Nova starts talking — gives the candidate a moment
  // to settle in instead of being dropped straight into the interview.
  useEffect(() => {
    if (novaPhase !== "ready") return;
    setReadySecondsLeft(READY_COUNTDOWN_SECONDS);
    let remaining = READY_COUNTDOWN_SECONDS;
    const intervalId = setInterval(() => {
      remaining -= 1;
      setReadySecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(intervalId);
        setNovaPhase("intro");
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [novaPhase]);

  // Nova's one-time self-introduction, before the first question — fires once the "ready"
  // countdown above hands off to "intro".
  useEffect(() => {
    if (novaPhase !== "intro") return;
    interviewerVoice.speak(novaIntro(interviewTitle), () => setNovaPhase("asking"));
    return () => interviewerVoice.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novaPhase]);

  // Nova speaks each question aloud; recording only starts once she's done.
  // From the second question on, she leads in with a short acknowledgement first.
  useEffect(() => {
    if (novaPhase !== "asking") return;
    const question = questions[currentQ];
    const spokenText =
      currentQ > 0
        ? `${TRANSITION_PHRASES[Math.floor(Math.random() * TRANSITION_PHRASES.length)]} ${question}`
        : question;
    interviewerVoice.speak(spokenText, beginListening);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novaPhase, currentQ]);

  // Show a full-screen warning takeover whenever a new proctoring violation comes in
  useEffect(() => {
    if (warnings.length <= prevWarningCountRef.current) return;
    prevWarningCountRef.current = warnings.length;
    if (disqualified) return; // the disqualified takeover handles this one instead

    // Always cut Nova off first (harmless no-op if she wasn't speaking), THEN announce the
    // warning — both synchronous and colocated here so the two voices can never overlap,
    // unlike triggering the announcement from the parent's state update.
    interviewerVoice.stop();
    const latest = warnings[warnings.length - 1];
    // Capture what the camera saw at the moment of the violation — much easier to review
    // later than scrubbing through the full recording to find this exact timestamp.
    const snapshot = captureVideoSnapshot(webcamVideoRef.current);
    if (snapshot) onWarningSnapshotRef.current(warnings.length - 1, snapshot);
    // While !disqualified, warnings.length is always 1..MAX_STRIKES-1 (the strike that hits
    // MAX_STRIKES flips `disqualified` in the same tick, so this effect never sees it as "not
    // disqualified") — safe to use directly as the strike number for the escalation copy/color.
    const strikeNumber = warnings.length;
    const remaining = MAX_STRIKES - strikeNumber;
    speakBrowserAnnouncement(
      `Warning ${strikeNumber} of ${MAX_STRIKES}. ${latest?.message ?? ""} ${
        remaining === 1 ? "One more violation will disqualify you." : `${remaining} more violations will disqualify you.`
      }`
    );

    if (latest?.type === "FULLSCREEN_EXIT") {
      // The persistent "return to fullscreen" takeover (below) handles this one instead — it
      // must stay up until the candidate actually returns, not disappear on a fixed timer
      // while they're still outside fullscreen.
      return;
    }

    setShowWarningOverlay(true);
    const timer = setTimeout(() => {
      setShowWarningOverlay(false);
      // Re-check the *current* disqualified state (not the stale value from when this
      // timer was scheduled) — a second violation may have escalated to disqualification
      // while this timer was pending, and we must not restart listening in that case.
      if (!disqualifiedRef.current && (novaPhase === "intro" || novaPhase === "asking")) {
        beginListening(); // she was interrupted mid-question; move on rather than replay
      }
    }, 3200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warnings.length, disqualified]);

  // Second violation: end the interview and submit whatever was recorded so far.
  // Uses its own guard ref (not advancingRef) so it can never be silently blocked by an
  // unrelated in-flight advance() — worst case both call stopRecording(), which is a no-op
  // if nothing is currently recording.
  useEffect(() => {
    if (!disqualified || disqualifyingRef.current) return;
    disqualifyingRef.current = true;
    interviewerVoice.stop();
    speakBrowserAnnouncement(disqualifyMessage);

    // This is the strike that ended the interview — the other warning effect skips capturing
    // a snapshot once `disqualified` is already true, so it never got one otherwise. Guarded
    // on "doesn't already have one" because the 5-second away-timeout disqualify path (see
    // page.tsx's handleAwayTimeout) sets `disqualified` without adding a new warning entry —
    // in that case the last warning already got its snapshot when it originally fired, and a
    // frame captured now (seconds later, while still away) would only overwrite it with a
    // less relevant one.
    const lastWarning = warnings[warnings.length - 1];
    if (lastWarning && !lastWarning.snapshot) {
      const snapshot = captureVideoSnapshot(webcamVideoRef.current);
      if (snapshot) onWarningSnapshotRef.current(warnings.length - 1, snapshot);
    }

    const timer = setTimeout(async () => {
      let finalRecordings = recordings;
      if (novaPhase === "listening") {
        const result = await stopRecording();
        finalRecordings = [
          ...recordings,
          {
            questionIndex: currentQ,
            question: questions[currentQ],
            transcript: result.transcript,
            startTime: result.startTime,
            endTime: result.endTime,
            duration: result.duration,
            videoUrl: result.videoUrl,
            audioUrl: result.audioUrl,
            videoBlob: result.videoBlob,
            audioBlob: result.audioBlob,
          },
        ];
      }
      onDisqualify(finalRecordings);
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disqualified]);

  async function advance() {
    if (novaPhase !== "listening" || advancingRef.current || disqualifiedRef.current) return;
    advancingRef.current = true;
    setNovaPhase("saving");

    const result = await stopRecording();
    const rec: QuestionRecording = {
      questionIndex: currentQ,
      question: questions[currentQ],
      transcript: result.transcript,
      startTime: result.startTime,
      endTime: result.endTime,
      duration: result.duration,
      videoUrl: result.videoUrl,
      audioUrl: result.audioUrl,
      videoBlob: result.videoBlob,
      audioBlob: result.audioBlob,
    };

    const updated = [...recordings, rec];
    setRecordings(updated);

    if (currentQ < questions.length - 1) {
      resetTimer();
      setCurrentQ((q) => q + 1);
      setNovaPhase("asking");
      advancingRef.current = false;
    } else {
      onSubmit(updated);
    }
  }

  // Same escalation ladder used in the warning-announcement effect above: while not
  // disqualified, warnings.length is always 1..MAX_STRIKES-1, so this is 1 or 2 for the
  // default MAX_STRIKES=3 (yellow for the first strike, orange for the second).
  const warningVariant: "warning-1" | "warning-2" = warnings.length >= MAX_STRIKES - 1 ? "warning-2" : "warning-1";

  const isLast = currentQ === questions.length - 1;
  const avatarState: AvatarState =
    novaPhase === "saving" ? "saving" : novaPhase === "listening" ? "listening" : "speaking";

  const isNovaSpeakingUI = novaPhase === "intro" || novaPhase === "asking";
  const novaSpeakingText = novaPhase === "intro" ? novaIntro(interviewTitle) : questions[currentQ];
  const typedNovaText = useVoiceSyncedText({
    text: novaSpeakingText,
    active: isNovaSpeakingUI && !showWarningOverlay && !disqualified && isFullscreen,
    voiceState: interviewerVoice.state,
    progressRef: interviewerVoice.progressRef,
  });

  return (
    <div className="interview-layout">
      {disqualified && (
        <FullscreenTakeover variant="disqualified">
          <i className="ti ti-ban nova-takeover-icon" />
          <h2 className="nova-takeover-title">Disqualified</h2>
          <p className="nova-takeover-text">{disqualifyMessage}</p>
        </FullscreenTakeover>
      )}

      {/* Esc (and similar) can't be blocked from exiting fullscreen — that's a browser
          guarantee, not a bug — so this takes over the whole screen and stays up until the
          candidate clicks back into fullscreen themselves; nothing else is clickable until then. */}
      {!disqualified && !isFullscreen && (
        <FullscreenTakeover variant={warningVariant}>
          <i className="ti ti-maximize nova-takeover-icon" />
          <h2 className="nova-takeover-title">Return to Fullscreen — Warning {warnings.length} of {MAX_STRIKES}</h2>
          <p className="nova-takeover-text">
            You exited fullscreen mode. This has been recorded as a violation. Click below to
            return to fullscreen and continue.
          </p>
          <button
            className="btn-primary"
            style={{ marginTop: "1.25rem" }}
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
          >
            <i className="ti ti-maximize" /> Return to Fullscreen
          </button>
        </FullscreenTakeover>
      )}

      {!disqualified && isFullscreen && showWarningOverlay && (
        <FullscreenTakeover variant={warningVariant}>
          <i className="ti ti-alert-triangle nova-takeover-icon" />
          <h2 className="nova-takeover-title">Warning {warnings.length} of {MAX_STRIKES}</h2>
          <p className="nova-takeover-text">{warnings[warnings.length - 1]?.message}</p>
        </FullscreenTakeover>
      )}

      {!disqualified && isFullscreen && !showWarningOverlay && novaPhase === "ready" && (
        <FullscreenTakeover variant="ready">
          <div className="ready-ring-wrap">
            <svg className="ready-ring" viewBox="0 0 120 120">
              <circle className="ready-ring-track" cx="60" cy="60" r={READY_RING_RADIUS} />
              <circle
                className="ready-ring-fill"
                cx="60" cy="60" r={READY_RING_RADIUS}
                style={{
                  strokeDasharray: READY_RING_CIRCUMFERENCE,
                  strokeDashoffset:
                    READY_RING_CIRCUMFERENCE * (readySecondsLeft / READY_COUNTDOWN_SECONDS),
                }}
              />
            </svg>
            <div className="ready-ring-number">{readySecondsLeft}</div>
          </div>
          <h2 className="nova-takeover-title">Your Interview is Ready</h2>
          <p className="nova-takeover-text">Be confident and best of luck!</p>
        </FullscreenTakeover>
      )}

      {!disqualified && isFullscreen && !showWarningOverlay && (novaPhase === "intro" || novaPhase === "asking") && (
        <FullscreenTakeover variant="nova">
          <InterviewerAvatar state="speaking" hideMeta />
          <p className="nova-takeover-text">
            {typedNovaText}
            <span className="nova-caret" />
          </p>
        </FullscreenTakeover>
      )}

      {/* Main */}
      <div className="interview-main">
        {/* Top bar */}
        <div className="top-bar">
          <div className="timer-area">
            {novaPhase === "listening" ? (
              <>
                <span className="rec-dot" />
                <span className="rec-label">REC Q{currentQ + 1}</span>
              </>
            ) : (
              <span className="q-counter">Q{currentQ + 1}</span>
            )}
            <span className="timer-display">{formatTime(elapsed)}</span>
          </div>
          <div className="top-bar-right">
            {warnings.length > 0 && (
              <div className="warn-count">
                <i className="ti ti-alert-triangle" />
                {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
              </div>
            )}
            <div className="q-counter">Q {currentQ + 1} / {questions.length}</div>
          </div>
        </div>

        {/* Progress */}
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(currentQ / questions.length) * 100}%` }} />
        </div>

        {/* Nova avatar */}
        <InterviewerAvatar state={avatarState} />

        {/* Question */}
        <div className="question-box">
          <div className="q-label">Question {currentQ + 1}</div>
          <p className="q-text">{questions[currentQ]}</p>
        </div>

        {/* Voice transcript display — read-only, auto-fills from speech */}
        <div className="transcript-area">
          <div className="transcript-header">
            <div className="transcript-label-row">
              <i className="ti ti-microphone" />
              <span>Your answer (spoken)</span>
              {isListening && (
                <span className="listening-badge">
                  <span className="pulse-dot" /> Listening…
                </span>
              )}
            </div>
            <div className="transcript-hint">Speak your answer — text appears here automatically</div>
          </div>
          <div className="transcript-display">
            {transcript
              ? <span>{transcript}</span>
              : <span className="transcript-placeholder">Start speaking — your answer will appear here...</span>
            }
            {isListening && <span className="cursor-blink">|</span>}
          </div>
        </div>

        <div className="action-row">
          <button
            className="btn-primary"
            onClick={advance}
            disabled={novaPhase !== "listening"}
            style={{ opacity: novaPhase !== "listening" ? 0.6 : 1 }}
          >
            {novaPhase === "saving"
              ? <><i className="ti ti-loader-2 spin" /> Saving recording…</>
              : isLast
              ? "Submit Interview"
              : "Next Question →"}
          </button>
          <button className="btn-warn-sim" onClick={onSimulateWarning}>
            Simulate Warning
          </button>
        </div>

        {/* Completed questions */}
        {recordings.length > 0 && (
          <div className="completed-qs">
            <div className="completed-title">
              <i className="ti ti-check" /> Completed
            </div>
            {recordings.map((r, i) => (
              <div key={i} className="completed-item">
                <span className="completed-q-num">Q{i + 1}</span>
                <span className="completed-q-text">{r.question.substring(0, 55)}…</span>
                <span className="completed-duration">{formatTime(r.duration)}</span>
                <i className="ti ti-circle-check" style={{ color: "var(--green)" }} />
              </div>
            ))}
          </div>
        )}

        {/* Warning log */}
        {warnings.length > 0 && (
          <div className="warn-log">
            <div className="warn-log-title">
              <i className="ti ti-list" /> Warning log
            </div>
            {warnings.map((w, i) => (
              <div key={i} className="warn-log-item">
                <span className="warn-time">{w.timestamp}</span>
                <span className="warn-type">{w.type.replace(/_/g, " ")}</span>
                <span className="warn-msg">{w.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="webcam-box">
          <video ref={webcamVideoRef} autoPlay muted playsInline className="webcam-video" />
          <div className="webcam-label">
            <span className="rec-dot" style={{ width: 6, height: 6 }} /> LIVE
          </div>
        </div>
        <div className="monitor-card">
          <div className="monitor-title">
            <i className="ti ti-radar" /> Monitoring
          </div>
          <div className="monitor-list">
            <MonItem icon="ti-device-desktop" label="Screen" on={true} />
            <MonItem icon="ti-camera" label="Webcam" on={true} />
            <MonItem
              icon="ti-face-id"
              label={`Face: ${
                faceStatus === "ok" ? "OK"
                : faceStatus === "missing" ? "Not detected"
                : faceStatus === "multiple" ? "Multiple faces"
                : faceStatus === "unavailable" ? "Unavailable"
                : "Starting…"
              }`}
              on={faceStatus === "ok"}
              warn={faceStatus === "missing" || faceStatus === "multiple"}
            />
            <MonItem
              icon="ti-device-mobile"
              label={`Phone: ${
                objectStatus === "clear" ? "Clear"
                : objectStatus === "detected" ? "Detected"
                : objectStatus === "unavailable" ? "Unavailable"
                : "Starting…"
              }`}
              on={objectStatus === "clear"}
              warn={objectStatus === "detected"}
            />
            <MonItem
              icon="ti-photo"
              label={`Background: ${
                backgroundStatus === "stable" ? "Stable"
                : backgroundStatus === "changed" ? "Changed"
                : backgroundStatus === "unavailable" ? "Unavailable"
                : "Starting…"
              }`}
              on={backgroundStatus === "stable"}
              warn={backgroundStatus === "changed"}
            />
            <MonItem icon="ti-microphone" label="Mic" on={isListening} />
            <MonItem icon="ti-volume" label="System audio" on={true} />
            <MonItem icon="ti-alert-triangle" label={`Warnings: ${warnings.length}`} on={false} warn={warnings.length > 0} />
            <MonItem icon="ti-repeat" label={`Tab switches: ${tabChanges}`} on={false} warn={tabChanges > 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MonItem({ icon, label, on, warn }: { icon: string; label: string; on: boolean; warn?: boolean }) {
  return (
    <div className="monitor-item">
      <span className={`monitor-dot ${warn ? "monitor-dot--warn" : on ? "monitor-dot--on" : "monitor-dot--off"}`} />
      <i className={`ti ${icon}`} />
      <span>{label}</span>
    </div>
  );
}

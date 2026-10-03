"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { InterviewStep as InterviewStepValue, Warning, WarningType, InterviewJSON, QuestionRecording, AppUser, InterviewConfig } from "@/types";
import { useProctoring } from "@/hooks/useProctoring";
import { useTimer } from "@/hooks/useTimer";
import type { BodyLogEntry } from "@/hooks/useBehaviorLog";
import { generateId } from "@/lib/utils";
import { WARNING_MESSAGES, MAX_STRIKES } from "@/lib/constants";
import type { VoicePreset } from "@/hooks/useInterviewerVoice";
import { useTheme } from "@/hooks/useTheme";
import appData from "@/lib/appData.json";

import { HomePage } from "@/components/HomePage";
import { LoginStep } from "@/components/LoginStep";
import { LandingStep } from "@/components/LandingStep";
import { PermissionsStep } from "@/components/PermissionsStep";
import { InterviewStep } from "@/components/InterviewStep";
import { ProcessingStep } from "@/components/ProcessingStep";
import { SubmittedStep } from "@/components/SubmittedStep";

interface Streams {
  screen: MediaStream | null;
  webcam: MediaStream | null;
  mic: MediaStream | null;
}

const INTERVIEWS = appData.interviews as InterviewConfig[];

export default function InterviewPage() {
  // Lifted here (rather than let each step read its own) so the theme carries over instantly
  // as the candidate moves between the home page and the login/landing/permissions/interview/
  // submitted flow within the same session, not just on the next full page load.
  const { dark, toggleTheme } = useTheme();
  const [step, setStep] = useState<InterviewStepValue>("home");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [voicePreset, setVoicePreset] = useState<VoicePreset>("veda");
  const [streams, setStreams] = useState<Streams>({ screen: null, webcam: null, mic: null });
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [bodyLog, setBodyLog] = useState<BodyLogEntry[]>([]);
  const [tabChanges, setTabChanges] = useState(0);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [finalData, setFinalData] = useState<InterviewJSON | null>(null);
  const [submittedRecordings, setSubmittedRecordings] = useState<QuestionRecording[]>([]);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [disqualifyMessage, setDisqualifyMessage] = useState("");
  const [finalStatus, setFinalStatus] = useState<"completed" | "disqualified">("completed");

  const strikeCountRef = useRef(0);
  const lastWarningAtRef = useRef(0);
  const disqualifiedRef = useRef(false);
  const interviewId = generateId("interview");
  const candidateId = generateId("candidate");

  const activeInterview: InterviewConfig =
    INTERVIEWS.find((i) => i.id === currentUser?.interviewId) ?? INTERVIEWS[0];

  const { elapsed } = useTimer(step === "interview");

  const handleWarning = useCallback((type: WarningType, message: string, timestamp: string) => {
    if (disqualifiedRef.current) return;

    // A single tab-switch fires both a "visibilitychange" and a window "blur" event almost
    // simultaneously — without this, one physical action would count as two strikes and
    // disqualify the candidate instantly. Treat anything within 800ms as the same incident.
    const now = Date.now();
    if (now - lastWarningAtRef.current < 800) return;
    lastWarningAtRef.current = now;

    strikeCountRef.current += 1;
    const isFinal = strikeCountRef.current >= MAX_STRIKES;
    setWarnings((prev) => [...prev, { type, timestamp, message }]);
    if (type === "TAB_CHANGE") setTabChanges((c) => c + 1);

    if (isFinal) {
      const msg = `You have been disqualified for repeated policy violations. ${message} Your interview is being submitted now.`;
      disqualifiedRef.current = true;
      setDisqualifyMessage(msg);
      setFinalStatus("disqualified");
      setIsDisqualified(true);
    }
    // Speaking (both the "only warning" and disqualify announcements) happens inside
    // InterviewStep, colocated with stopping Nova's audio — doing it here would race the
    // prop update and could play both voices at once.
  }, []);

  const handleBodyLogEntry = useCallback((entry: BodyLogEntry) => {
    setBodyLog((prev) => [...prev, entry]);
  }, []);

  // Attaches a webcam snapshot (captured in InterviewStep, which has the live video element)
  // to the warning at this index — index rather than timestamp, since timestamps only have
  // 1-second resolution and two violations firing close together could collide.
  const handleWarningSnapshot = useCallback((index: number, snapshot: string) => {
    setWarnings((prev) => prev.map((w, i) => (i === index ? { ...w, snapshot } : w)));
  }, []);

  const handleAwayTimeout = useCallback(() => {
    if (disqualifiedRef.current) return;
    disqualifiedRef.current = true;
    const msg = "You have been disqualified for leaving the interview tab for too long. Your interview is being submitted now.";
    setDisqualifyMessage(msg);
    setFinalStatus("disqualified");
    setIsDisqualified(true);
  }, []);

  const { triggerWarning } = useProctoring({
    active: step === "interview",
    onWarning: handleWarning,
    onAwayTimeout: handleAwayTimeout,
  });

  // Leave fullscreen once the interview itself is over — the report screen shouldn't be stuck
  // fullscreen, and this runs after useProctoring's own cleanup has already detached its
  // fullscreenchange listener (same render commit, effects declared above run first), so this
  // programmatic exit is never mistaken for the candidate leaving fullscreen mid-interview.
  useEffect(() => {
    if (step !== "interview" && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [step]);

  function handleLogin(user: AppUser) {
    setCurrentUser(user);
    setStep("landing");
  }

  function handleStreamsReady(s: Streams) {
    setStreams(s);
    setStartTime(new Date().toISOString());
    setStep("interview");

    // Auto-enter fullscreen when the interview starts — exiting it counts as a violation via
    // useProctoring's fullscreenchange listener, same grace/strike system as a tab switch.
    // Best-effort: some browsers require this closer to the original click than this async
    // permission-grant callback allows, so it must never block the interview from starting.
    document.documentElement.requestFullscreen?.().catch((err) => {
      console.warn("[page] Could not enter fullscreen automatically:", err);
    });

    // Detect screen share stopped
    s.screen?.getVideoTracks()[0]?.addEventListener("ended", () => {
      handleWarning("SCREEN_STOPPED", WARNING_MESSAGES.SCREEN_STOPPED, new Date().toISOString().substr(11, 8));
    });
    s.webcam?.getVideoTracks()[0]?.addEventListener("ended", () => {
      handleWarning("CAMERA_DISABLED", WARNING_MESSAGES.CAMERA_DISABLED, new Date().toISOString().substr(11, 8));
    });
    s.mic?.getAudioTracks()[0]?.addEventListener("ended", () => {
      handleWarning("MIC_DISABLED", WARNING_MESSAGES.MIC_DISABLED, new Date().toISOString().substr(11, 8));
    });
  }

  function handleSubmit(recordings: QuestionRecording[]) {
    // Stop all streams
    [streams.screen, streams.webcam, streams.mic].forEach((s) =>
      s?.getTracks().forEach((t) => t.stop())
    );
    setEndTime(new Date().toISOString());
    setSubmittedRecordings(recordings);
    setStep("processing");
  }

  function handleDisqualify(recordings: QuestionRecording[]) {
    [streams.screen, streams.webcam, streams.mic].forEach((s) =>
      s?.getTracks().forEach((t) => t.stop())
    );
    setEndTime(new Date().toISOString());
    setSubmittedRecordings(recordings);
    setStep("processing");
  }

  function handleProcessingDone() {
    const totalDuration = submittedRecordings.reduce((acc, r) => acc + r.duration, 0);
    // Disqualified (2-strike auto-cutoff) always wins. Otherwise, an interview that completed
    // in full but still picked up at least one proctoring warning is flagged "rejected" rather
    // than a clean "completed" — didn't cross the disqualify line, but wasn't clean either.
    const status: InterviewJSON["status"] =
      finalStatus === "disqualified" ? "disqualified" : warnings.length > 0 ? "rejected" : "completed";
    const json: InterviewJSON = {
      interviewId,
      candidateId,
      status,
      startTime,
      endTime: endTime || new Date().toISOString(),
      duration: totalDuration,
      tabChange: tabChanges,
      warningCount: warnings.length,
      warnings,
      questions: submittedRecordings,
      bodyLog,
    };
    setFinalData(json);
    setStep("submitted");
  }

  function handleRestart() {
    setStep("login");
    setCurrentUser(null);
    setStreams({ screen: null, webcam: null, mic: null });
    setWarnings([]);
    setBodyLog([]);
    setTabChanges(0);
    setStartTime("");
    setEndTime("");
    setFinalData(null);
    setSubmittedRecordings([]);
    strikeCountRef.current = 0;
    disqualifiedRef.current = false;
    setIsDisqualified(false);
    setDisqualifyMessage("");
    setFinalStatus("completed");
  }

  return (
    <>
      {step === "home" && <HomePage onStart={() => setStep("login")} dark={dark} onToggleTheme={toggleTheme} />}

      {step !== "home" && (
        <div className="app-shell" data-theme={dark ? "dark" : "light"}>
          {step === "login" && <LoginStep onLogin={handleLogin} onBack={() => setStep("home")} />}

          {step === "landing" && (
            <LandingStep
              title={activeInterview.title}
              subtitle={activeInterview.subtitle}
              questionCount={activeInterview.questions.length}
              voicePreset={voicePreset}
              onVoicePresetChange={setVoicePreset}
              onContinue={() => setStep("permissions")}
            />
          )}

          {step === "permissions" && <PermissionsStep onReady={handleStreamsReady} />}

          {step === "interview" && streams.screen && streams.webcam && streams.mic && (
            <InterviewStep
              interviewTitle={activeInterview.title}
              questions={activeInterview.questions}
              screenStream={streams.screen}
              webcamStream={streams.webcam}
              micStream={streams.mic}
              warnings={warnings}
              tabChanges={tabChanges}
              onSubmit={handleSubmit}
              onSimulateWarning={() => triggerWarning("TAB_CHANGE")}
              disqualified={isDisqualified}
              disqualifyMessage={disqualifyMessage}
              onDisqualify={handleDisqualify}
              onVisionWarning={handleWarning}
              onBodyLogEntry={handleBodyLogEntry}
              onWarningSnapshot={handleWarningSnapshot}
              voicePreset={voicePreset}
            />
          )}

          {step === "processing" && <ProcessingStep onDone={handleProcessingDone} />}

          {step === "submitted" && finalData && (
            <SubmittedStep data={finalData} onRestart={handleRestart} />
          )}
        </div>
      )}
    </>
  );
}

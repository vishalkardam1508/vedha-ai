"use client";

import type { VoicePreset } from "@/hooks/useInterviewerVoice";

interface LandingStepProps {
  title: string;
  subtitle: string;
  questionCount: number;
  voicePreset: VoicePreset;
  onVoicePresetChange: (preset: VoicePreset) => void;
  onContinue: () => void;
}

const VOICE_OPTIONS: { id: VoicePreset; label: string; desc: string }[] = [
  { id: "veda", label: "Veda", desc: "Indian female voice (default)" },
  { id: "nova", label: "Nova", desc: "Indian female voice" },
  { id: "dhruv", label: "Dhruv", desc: "Male voice" },
];

export function LandingStep({
  title,
  subtitle,
  questionCount,
  voicePreset,
  onVoicePresetChange,
  onContinue,
}: LandingStepProps) {
  return (
    <div className="card">
      <div className="badge">
        <span className="dot" />
        Veda AI Interview Platform
      </div>
      <h1 className="heading">{title}<br />{subtitle}</h1>
      <p className="sub">
        A fully monitored AI interview. Your screen, webcam, and microphone are recorded
        per-question — each answer produces its own video and audio file. Speak your answers;
        live transcription runs automatically.
      </p>
      <div className="meta-row">
        {[
          ["ti-help-circle", `${questionCount} Questions`],
          ["ti-video", "Per-question recording"],
          ["ti-microphone", "Voice-to-text"],
          ["ti-shield-check", "AI Proctored"],
        ].map(([ic, lb]) => (
          <div key={lb} className="meta-item">
            <i className={`ti ${ic}`} />{lb}
          </div>
        ))}
      </div>
      <div className="info-box">
        <i className="ti ti-info-circle" />
        <span>
          Use <strong>Google Chrome only</strong> for full system audio and speech recognition support.
          Allow all permissions when prompted. The interview runs in <strong>fullscreen</strong> —
          do not switch tabs, minimize, or exit fullscreen during the interview. Your camera is also
          monitored for anything covering your face, such as a phone or object — all of this is
          tracked, and doing so may disqualify you.
        </span>
      </div>
      <div className="voice-picker-label">Choose Your Interviewer's Voice</div>
      <div className="voice-picker">
        {VOICE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`voice-option${voicePreset === opt.id ? " voice-option--active" : ""}`}
            onClick={() => onVoicePresetChange(opt.id)}
          >
            <span className="voice-option-check">
              {voicePreset === opt.id && <i className="ti ti-check" />}
            </span>
            <span className="voice-option-body">
              <span className="voice-option-name">{opt.label}</span>
              <span className="voice-option-desc">{opt.desc}</span>
            </span>
          </button>
        ))}
      </div>

      <button className="btn-primary" onClick={onContinue}>
        Continue to Permissions →
      </button>
    </div>
  );
}

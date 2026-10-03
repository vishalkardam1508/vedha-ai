"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { InterviewerAvatar } from "@/components/InterviewerAvatar";
import { HomeDemoPanel } from "@/components/HomeDemoPanel";
import { pickVoice, type VoicePreset } from "@/hooks/useInterviewerVoice";
import { useTheme } from "@/hooks/useTheme";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface HomePageProps {
  onStart: () => void;
  // Optional — when the parent already owns theme state (see src/app/page.tsx, which shares
  // it with the rest of the app), pass it down so there's a single source of truth. Falls back
  // to managing its own via useTheme() when used standalone.
  dark?: boolean;
  onToggleTheme?: () => void;
}

// Each voice introduces itself by its own name here — a punchier way to preview them side by
// side on this page. The actual interviewer is always "Veda" once a real interview starts
// (see novaIntro() in lib/constants.ts), regardless of which of these voice styles is picked.
function voiceDemoScript(label: string): string {
  return (
    `Hi, I'm ${label}, your AI interviewer — glad to meet you! I'll ask you questions, listen closely, ` +
    "and keep your interview fair and fully proctored, right here in your browser."
  );
}

const VOICE_DEMOS: { id: VoicePreset; label: string; desc: string }[] = [
  { id: "veda", label: "Veda", desc: "Indian female voice" },
  { id: "nova", label: "Nova", desc: "Indian female voice" },
  { id: "dhruv", label: "Dhruv", desc: "Male voice" },
];

function speakVoiceDemo(preset: VoicePreset, label: string, onEnd: () => void) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const say = () => {
    const utterance = new SpeechSynthesisUtterance(voiceDemoScript(label));
    utterance.rate = 0.95;
    const voice = pickVoice(preset);
    if (voice) utterance.voice = voice;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    window.speechSynthesis.speak(utterance);
  };

  // Chrome loads voices asynchronously — on a fresh page load getVoices() can still be empty
  // the first time a button is clicked, in which case wait for the one-time "ready" event.
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", say, { once: true });
  } else {
    say();
  }
}

const STATS: [string, string][] = [
  ["100%", "Independent — No Third-Party Reliance"],
  ["9", "Proctoring Signals"],
  ["3-Strike", "Fair Escalation"],
  ["Flexible", "Your Own Server, As Per Requirement"],
];

const PROBLEMS: [string, string][] = [
  ["ti-eye-off", "Someone off-camera feeding answers"],
  ["ti-device-mobile", "A phone or notes held up, just out of frame"],
  ["ti-repeat", "Tab-switching away to search for answers"],
  ["ti-home", "No way to verify the room is actually private"],
  ["ti-history", "Cheating discovered on review — after it already mattered"],
];

const SOLUTIONS: [string, string][] = [
  ["ti-face-id", "Face detection tuned to catch background people too, not just the candidate"],
  ["ti-scan", "Object detection flags a phone at close range, even partially in frame"],
  ["ti-shield-check", "Tab-switching and exiting fullscreen are strikes, not silent log entries"],
  ["ti-checklist", "An automatic environment and connection check before the interview even starts"],
  ["ti-camera", "Every violation is flagged live, with a timestamped photo, as it happens"],
];

const FEATURES: [string, string, string][] = [
  ["ti-microphone-2", "Voice AI Interviewer", "\"Veda\" speaks every question aloud and listens to your spoken answer in real time."],
  ["ti-face-id", "Face & Object Monitoring", "Live face-presence detection plus phone/object-covering-face detection, both before and throughout the interview."],
  ["ti-shield-lock", "Proctoring with Escalation", "Auto-fullscreen, screen, webcam, mic, tab-switch and fullscreen-exit monitoring with a fair warn-then-disqualify policy."],
  ["ti-briefcase", "Multi-Role Interviews", "Separate question sets for Frontend, Python and Node.js roles, selected per candidate."],
  ["ti-wifi", "Connection Speedometer", "A sequential download, upload and latency test with a live speedometer gauge — not a single-file guess."],
  ["ti-activity", "Behavior Log", "Passive expression, posture, gaze and stress-heuristic logging per question — informational only, never a violation."],
];

const STACKS = ["React", "Next.js", "Vue.js", "Angular", "HTML / JS"];

const FLAGGED_VIOLATIONS: [string, string][] = [
  ["ti-repeat", "Tab switching or window blur"],
  ["ti-microphone-2", "Microphone disabled"],
  ["ti-video-off", "Camera disabled"],
  ["ti-screen-share-off", "Screen sharing stopped"],
  ["ti-face-id", "Face not visible or multiple faces"],
  ["ti-device-mobile", "A phone or object covering the face"],
  ["ti-maximize", "Exiting fullscreen mode"],
  ["ti-photo", "Background or environment moving or changing"],
];

export function HomePage({ onStart, dark: darkProp, onToggleTheme }: HomePageProps) {
  const [playingVoice, setPlayingVoice] = useState<VoicePreset | null>(null);
  // Cancelling the previous utterance (below) fires *its* onend/onerror — without this guard,
  // that stale callback (bound to the old preset) can fire after we've already set state for
  // the newly-clicked voice, immediately wiping the new "playing" state back to null and
  // hiding the bars the instant you switch voices.
  const playRequestIdRef = useRef(0);
  // Shared with /practice and the interview flow via localStorage — toggling anywhere applies
  // everywhere. Prefers the parent's state (page.tsx) when given so a toggle here is instant
  // everywhere in the same session; falls back to owning it when used standalone.
  const ownTheme = useTheme();
  const dark = darkProp ?? ownTheme.dark;
  const toggleTheme = onToggleTheme ?? ownTheme.toggleTheme;

  // Fades each section (and its grid of cards) in as it scrolls into view — the hero stays
  // exempt since it's already on screen at load and shouldn't start invisible.
  useScrollReveal();

  // Don't let a demo voice keep talking after the visitor navigates away from this page.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function handlePlayVoice(preset: VoicePreset, label: string) {
    if (playingVoice === preset) {
      playRequestIdRef.current++;
      window.speechSynthesis?.cancel();
      setPlayingVoice(null);
      return;
    }
    const requestId = ++playRequestIdRef.current;
    setPlayingVoice(preset);
    speakVoiceDemo(preset, label, () => {
      if (playRequestIdRef.current === requestId) setPlayingVoice(null);
    });
  }

  return (
    <div className="home-page" data-theme={dark ? "dark" : "light"}>
      {/* Nav */}
      <nav className="home-nav">
        <div className="home-container home-nav-inner">
          <div className="home-nav-brand">
            <span className="home-nav-logo">
              <InterviewerAvatar state="idle" hideMeta />
            </span>
            <span className="home-nav-brand-text">Veda AI Interview Platform</span>
          </div>
          <div className="home-nav-actions">
            <button
              type="button"
              className="home-theme-toggle"
              onClick={toggleTheme}
              aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
              title={dark ? "Switch to light theme" : "Switch to dark theme"}
            >
              <i className={`ti ${dark ? "ti-sun" : "ti-moon"}`} />
            </button>
            <button className="btn-primary" onClick={onStart}>Try Demo →</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="home-hero-band">
        <div className="home-container home-hero-grid">
          <div className="home-hero-inner">
            <div className="badge home-hero-badge">
              <span className="dot" /> Demo Application
            </div>
            <h1 className="home-hero-title">AI-Powered Interviews,<br />Built for the Browser</h1>
            <p className="home-hero-sub">
              A fully voice-driven, AI-proctored interview experience — a spoken AI interviewer, live face
              and environment monitoring, and per-question recording, all running client-side.
            </p>
            <div className="home-hero-actions">
              <button className="btn-primary home-hero-cta" onClick={onStart}>Try Live Demo →</button>
            </div>
          </div>

          <div className="home-hero-demo">
            <HomeDemoPanel />
          </div>
        </div>
      </section>

      {/* Voice demo */}
      <section className="home-band home-band--tint reveal">
        <div className="home-container">
          <div className="home-section-heading">
            <div className="home-eyebrow">Hear It For Yourself</div>
            <h2 className="home-section-title">Meet Your AI Interviewer</h2>
            <p className="home-section-sub">
              The interviewer is always Veda — these are three voice styles you can pick from
              before an interview starts. Press play to compare them.
            </p>
          </div>
          <div className="voice-card-grid reveal-stagger">
            {VOICE_DEMOS.map((v) => {
              const isPlaying = playingVoice === v.id;
              return (
                <div key={v.id} className={`voice-card${isPlaying ? " voice-card--playing" : ""}`}>
                  <div className="voice-card-icon">
                    <i className="ti ti-microphone-2" />
                  </div>
                  <div className="voice-card-name">{v.label}</div>
                  <div className="voice-card-desc">{v.desc}</div>
                  <div className="voice-bars" aria-hidden="true">
                    <span /><span /><span /><span /><span />
                  </div>
                  <button type="button" className="voice-card-btn" onClick={() => handlePlayVoice(v.id, v.label)}>
                    <i className={`ti ${isPlaying ? "ti-player-stop" : "ti-player-play"}`} />
                    {isPlaying ? "Stop" : "Play"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Credibility strip */}
      <section className="home-band home-stats-band reveal">
        <div className="home-container home-stats-row reveal-stagger">
          {STATS.map(([num, label]) => (
            <div key={label} className="home-stat-item">
              <div className="home-stat-num">{num}</div>
              <div className="home-stat-label">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Problem / solution */}
      <section className="home-band home-band--tint reveal">
        <div className="home-container">
          <div className="home-section-heading">
            <div className="home-eyebrow">Why This Exists</div>
            <h2 className="home-section-title">Remote Interviews Are Easy to Game</h2>
            <p className="home-section-sub">
              A video call alone doesn't stop any of this. Here's what a plain call misses, and what actually
              closes each gap.
            </p>
          </div>
          <div className="home-problem-solution">
            <div>
              <div className="home-ps-heading home-ps-heading--problem">The Problem</div>
              <div className="home-ps-list reveal-stagger">
                {PROBLEMS.map(([icon, text]) => (
                  <div key={text} className="home-ps-card home-ps-card--problem">
                    <div className="home-ps-icon-badge">
                      <i className={`ti ${icon}`} />
                    </div>
                    <div className="home-ps-text">{text}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="home-ps-heading home-ps-heading--solution">How Veda Closes It</div>
              <div className="home-ps-list reveal-stagger">
                {SOLUTIONS.map(([icon, text]) => (
                  <div key={text} className="home-ps-card home-ps-card--solution">
                    <div className="home-ps-icon-badge">
                      <i className={`ti ${icon}`} />
                    </div>
                    <div className="home-ps-text">{text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="home-band reveal">
        <div className="home-container">
          <div className="home-section-heading">
            <div className="home-eyebrow">Capabilities</div>
            <h2 className="home-section-title">What This Demo Shows</h2>
          </div>
          <div className="home-feature-grid reveal-stagger">
            {FEATURES.map(([icon, title, desc]) => (
              <div key={title} className="home-feature-card">
                <i className={`ti ${icon}`} />
                <div className="home-feature-title">{title}</div>
                <div className="home-feature-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security in depth / escalation policy */}
      <section className="home-band home-band--tint reveal">
        <div className="home-container">
          <div className="home-section-heading">
            <div className="home-eyebrow">Security in Depth</div>
            <h2 className="home-section-title">Make Sure You're Alone in a Clean, Quiet Environment</h2>
            <p className="home-section-sub">
              If we detect anything from the list below during your interview, your application will be
              disqualified.
            </p>
          </div>
          <div className="home-reject-grid reveal-stagger">
            {FLAGGED_VIOLATIONS.map(([icon, label]) => (
              <div key={label} className="home-reject-card">
                <div className="home-reject-icon-badge">
                  <i className={`ti ${icon}`} />
                </div>
                <div className="home-reject-card-label">{label}</div>
              </div>
            ))}
          </div>
          <div className="home-reject-summary">
            <p className="home-reject-note">
              Two strikes end the interview immediately as <strong>Disqualified</strong>. A completed
              interview with even one flagged violation is marked <strong>Rejected</strong> rather than a
              clean pass — every flag is listed in full on the candidate's final report.
            </p>
          </div>
        </div>
      </section>

      {/* Practice & Learning */}
      <section className="home-band reveal">
        <div className="home-container">
          <div className="home-section-heading">
            <div className="home-eyebrow">New</div>
            <h2 className="home-section-title">Practice Before You Interview</h2>
            <p className="home-section-sub">
              A casual, unscored chat with Veda — not recorded, not proctored, just practice. Build
              conversational English fluency or warm up with a technical mock interview.
            </p>
          </div>
          <div className="practice-promo-grid reveal-stagger">
            <div className="practice-promo-card">
              <i className="ti ti-message-circle" />
              <div className="practice-promo-title">English Conversation</div>
              <div className="practice-promo-desc">Casual back-and-forth chat to build fluency and confidence speaking English.</div>
            </div>
            <div className="practice-promo-card">
              <i className="ti ti-code" />
              <div className="practice-promo-title">Technical Mock Interview</div>
              <div className="practice-promo-desc">Pick React, Node.js, JavaScript, Angular, or AI Engineering and get quizzed one question at a time.</div>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: "1.75rem" }}>
            <Link className="btn-primary" href="/practice">
              <i className="ti ti-arrow-right" /> Start Practicing
            </Link>
          </div>
        </div>
      </section>

      {/* Integration pitch */}
      <section className="home-band home-band--tint reveal">
        <div className="home-container">
          <div className="home-section-heading">
            <div className="home-eyebrow">Bring It Into Your Product</div>
            <h2 className="home-section-title">A Product You Can Integrate — Not Just a Demo</h2>
            <p className="home-section-sub">
              This is a ready-to-integrate solution you can customize and run inside your own system, on any
              stack. It runs entirely client-side — no candidate data is ever sent to a third-party service to
              function, so you're never relying on someone else's servers for your own data.
            </p>
          </div>
          <div className="home-stack-row reveal-stagger">
            {STACKS.map((s) => (
              <span key={s} className="home-stack-badge">{s}</span>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <a className="btn-primary" href="mailto:vishalkardam1508@gmail.com?subject=Interview%20Platform%20Integration">
              <i className="ti ti-mail" /> Contact Us for Integration
            </a>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="home-cta-band reveal">
        <div className="home-container home-cta-inner">
          <h2 className="home-cta-title">Ready to see it in action?</h2>
          <p className="home-cta-sub">Sign in with a demo account and experience the full interview flow.</p>
          <div className="home-cta-actions">
            <button className="btn-primary home-hero-cta" onClick={onStart}>Try Live Demo →</button>
            <a className="home-cta-secondary" href="mailto:vishalkardam1508@gmail.com?subject=Interview%20Platform%20Integration">
              Contact Us →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      {/* <footer className="home-footer">
        <div className="home-container home-footer-inner">
          <div className="home-footer-owner">Built by Vishal Kardam</div>
          <div className="home-footer-contact">
            <a href="mailto:vishalkardam1508@gmail.com">
              <i className="ti ti-mail" /> vishalkardam1508@gmail.com
            </a>
            <a href="tel:9027474653">
              <i className="ti ti-phone" /> 9027474653
            </a>
          </div>
          <div className="home-footer-more">
            For more, visit{" "}
            <a href="https://vishalkardam.vercel.app" target="_blank" rel="noopener noreferrer">
              vishalkardam.vercel.app
            </a>
          </div>
        </div>
      </footer> */}
    </div>
  );
}

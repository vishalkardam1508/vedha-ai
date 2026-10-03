"use client";

import { useEffect, useState } from "react";
import { InterviewerAvatar } from "@/components/InterviewerAvatar";

interface Scene {
  key: string;
  duration: number;
  render: () => React.ReactNode;
}

const WAVEFORM_BARS = [8, 16, 24, 14, 20, 10, 18, 12];

const SCENES: Scene[] = [
  {
    key: "instructions",
    duration: 3400,
    render: () => (
      <div className="demo-scene">
        <div className="demo-scene-title">Before You Start</div>
        <div className="demo-rule" style={{ animationDelay: "0.1s" }}>
          <i className="ti ti-brand-chrome" /> Use Google Chrome
        </div>
        <div className="demo-rule" style={{ animationDelay: "0.5s" }}>
          <i className="ti ti-forbid-2" /> Don't switch tabs
        </div>
        <div className="demo-rule" style={{ animationDelay: "0.9s" }}>
          <i className="ti ti-shield-check" /> Camera &amp; mic required
        </div>
      </div>
    ),
  },
  {
    key: "permissions",
    duration: 3400,
    render: () => (
      <div className="demo-scene">
        <div className="demo-scene-title">Requesting Permissions</div>
        {[
          ["ti-device-desktop", "Screen + Audio", "0.1s"],
          ["ti-camera", "Camera", "0.7s"],
          ["ti-microphone", "Microphone", "1.3s"],
        ].map(([icon, label, delay]) => (
          <div key={label} className="demo-perm-row" style={{ animationDelay: delay }}>
            <i className={`ti ${icon}`} /> {label}
            <i className="ti ti-circle-check demo-check" style={{ animationDelay: delay }} />
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "speed",
    duration: 3000,
    render: () => (
      <div className="demo-scene demo-scene--center">
        <svg viewBox="0 0 200 115" width="170" height="98" className="demo-gauge">
          <path d="M 20,100 A 80,80 0 0,1 180,100" fill="none" stroke="var(--border)" strokeWidth="12" strokeLinecap="round" />
          <path d="M 20,100 A 80,80 0 0,1 152,32" fill="none" stroke="var(--green)" strokeWidth="12" strokeLinecap="round" className="demo-gauge-fill" />
          <g className="demo-gauge-needle">
            <line x1="100" y1="100" x2="100" y2="32" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
          </g>
          <circle cx="100" cy="100" r="6" fill="var(--text)" />
        </svg>
        <div className="demo-scene-title">Connection: Good <span className="demo-accent">86 Mbps</span></div>
      </div>
    ),
  },
  {
    key: "face-check",
    duration: 3000,
    render: () => (
      <div className="demo-scene demo-scene--center">
        <div className="demo-face-box">
          <i className="ti ti-user" />
          <span className="demo-face-ring" />
        </div>
        <div className="demo-scene-title">Face detected <span className="demo-accent">✓</span> · Environment clear</div>
      </div>
    ),
  },
  {
    key: "question",
    duration: 3600,
    render: () => (
      <div className="demo-scene">
        <div className="demo-nova-row">
          <div className="demo-nova-avatar">
            <InterviewerAvatar state="speaking" hideMeta />
          </div>
          <div className="demo-bubble demo-bubble--bot">
            Tell me about yourself and your professional background…
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "answer",
    duration: 3200,
    render: () => (
      <div className="demo-scene">
        <div className="demo-listening-label">
          <span className="pulse-dot" /> Listening…
        </div>
        <div className="demo-waveform">
          {WAVEFORM_BARS.map((h, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.08}s`, height: `${h}px` }} />
          ))}
        </div>
        <div className="demo-bubble demo-bubble--user">
          "I'm a frontend developer with three years of experience building React apps…"
        </div>
      </div>
    ),
  },
  {
    key: "warning",
    duration: 2800,
    render: () => (
      <div className="demo-scene demo-scene--center">
        <div className="demo-banner demo-banner--warn">
          <i className="ti ti-alert-triangle" /> Tab switch detected — Warning 1/2
        </div>
      </div>
    ),
  },
  {
    key: "disqualified",
    duration: 2800,
    render: () => (
      <div className="demo-scene demo-scene--center">
        <div className="demo-banner demo-banner--danger">
          <i className="ti ti-ban" /> Multiple faces detected — Disqualified
        </div>
        <div className="demo-example-tag">(illustrative example)</div>
      </div>
    ),
  },
  {
    key: "report",
    duration: 3400,
    render: () => (
      <div className="demo-scene demo-scene--center">
        <div className="demo-success-icon">
          <i className="ti ti-check" />
        </div>
        <div className="demo-scene-title">Interview Submitted</div>
        <div className="demo-stat-row">
          <div><span>04:32</span><label>Duration</label></div>
          <div><span>0</span><label>Warnings</label></div>
          <div><span>5</span><label>Questions</label></div>
        </div>
        <div className="demo-example-tag">Report ready ✓</div>
      </div>
    ),
  },
];

export function HomeDemoPanel() {
  const [sceneIndex, setSceneIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let idx = 0;
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    async function run() {
      while (!cancelled) {
        await sleep(SCENES[idx].duration);
        if (cancelled) return;
        idx = (idx + 1) % SCENES.length;
        setSceneIndex(idx);
      }
    }
    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const scene = SCENES[sceneIndex];

  return (
    <div className="demo-frame">
      <div className="demo-chrome">
        <div className="demo-dots">
          <span className="demo-dot demo-dot--red" />
          <span className="demo-dot demo-dot--yellow" />
          <span className="demo-dot demo-dot--green" />
        </div>
        <div className="demo-url">ai-interview-platform.app</div>
      </div>
      <div className="demo-content">
        <div key={scene.key} className="demo-scene-wrap">
          {scene.render()}
        </div>
      </div>
    </div>
  );
}

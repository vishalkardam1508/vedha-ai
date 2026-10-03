"use client";

import { useState, useRef, useEffect } from "react";
import { usePreInterviewCheck } from "@/hooks/usePreInterviewCheck";
import { useConnectionSpeed, type SpeedPhase } from "@/hooks/useConnectionSpeed";

interface Streams {
  screen: MediaStream | null;
  webcam: MediaStream | null;
  mic: MediaStream | null;
}

const MIN_MBPS = 20; // download threshold that gates continuing, unchanged from before
const MIN_UPLOAD_MBPS = 5; // informational only — "good enough for a video call" floor
const MAX_GOOD_LATENCY_MS = 150; // informational only — "fine for realtime" cutoff

interface GaugeSpec {
  label: string;
  icon: string;
  unit: string;
  max: number;
  goodWhen: "high" | "low";
  threshold: number;
}

const PHASE_GAUGE: Record<SpeedPhase, GaugeSpec> = {
  download: { label: "Download Speed", icon: "ti-arrow-down", unit: "Mbps", max: 100, goodWhen: "high", threshold: MIN_MBPS },
  upload: { label: "Upload Speed", icon: "ti-arrow-up", unit: "Mbps", max: 50, goodWhen: "high", threshold: MIN_UPLOAD_MBPS },
  latency: { label: "Latency", icon: "ti-bolt", unit: "ms", max: 300, goodWhen: "low", threshold: MAX_GOOD_LATENCY_MS },
};

const PHASE_ORDER: SpeedPhase[] = ["download", "upload", "latency"];

function polarPoint(angleDeg: number, radius: number, cx: number, cy: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad) };
}

function isGood(value: number, spec: GaugeSpec): boolean {
  return spec.goodWhen === "high" ? value >= spec.threshold : value <= spec.threshold;
}

function SpeedGauge({ value, spec, active }: { value: number | null; spec: GaugeSpec; active: boolean }) {
  const clamped = Math.min(spec.max, Math.max(0, value ?? 0));
  const valueAngle = -90 + (clamped / spec.max) * 180;
  const trackStart = polarPoint(-90, 80, 100, 100);
  const trackEnd = polarPoint(90, 80, 100, 100);
  const fillEnd = polarPoint(valueAngle, 80, 100, 100);
  const largeArc = valueAngle + 90 >= 179.9 ? 1 : 0;
  const color = value === null ? "var(--text-dim)" : isGood(value, spec) ? "var(--green)" : "var(--red)";

  return (
    <svg viewBox="0 0 200 115" width="220" height="127" className="speed-gauge">
      <path
        d={`M ${trackStart.x},${trackStart.y} A 80,80 0 0,1 ${trackEnd.x},${trackEnd.y}`}
        fill="none" stroke="var(--border)" strokeWidth="14" strokeLinecap="round"
      />
      {value !== null && (
        <path
          d={`M ${trackStart.x},${trackStart.y} A 80,80 0 ${largeArc},1 ${fillEnd.x},${fillEnd.y}`}
          fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          className={active ? "speed-gauge-fill--live" : undefined}
        />
      )}
      {/* Needle tracks the live value in real time while the test is running, not a decorative sweep */}
      <g className="speed-gauge-needle" style={{ transform: `rotate(${value === null ? -90 : valueAngle}deg)`, transformOrigin: "100px 100px" }}>
        <line x1="100" y1="100" x2="100" y2="30" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="100" r="7" fill="var(--text)" />
    </svg>
  );
}

function SpeedCheckView({ onContinue }: { onContinue: () => void }) {
  const { status, phase, download, upload, latency, isLocalhost, start } = useConnectionSpeed();
  const passed = status === "done" && download !== null && download >= MIN_MBPS;
  const slow = status === "done" && download !== null && download < MIN_MBPS;
  const done = status === "done" || status === "error";

  const liveValue = phase === "download" ? download : phase === "upload" ? upload : latency;
  const liveSpec = PHASE_GAUGE[phase];
  const stepNum = PHASE_ORDER.indexOf(phase) + 1;

  return (
    <div className="card">
      <div className="badge">
        <i className="ti ti-wifi" /> Step 1 of 2 — Verifying
      </div>
      <h1 className="heading" style={{ fontSize: "1.6rem" }}>Checking Your Connection</h1>
      <p className="sub">
        We'll measure your download speed, upload speed, and latency, one at a time. A stable
        connection (at least {MIN_MBPS} Mbps download) helps ensure smooth recording throughout the interview.
      </p>

      {status === "testing" && (
        <div className="badge" style={{ marginBottom: "0.75rem" }}>
          Step {stepNum} of 3 — {liveSpec.label}
        </div>
      )}

      {!done && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.25rem" }}>
          <SpeedGauge value={status === "idle" ? null : liveValue} spec={liveSpec} active={status === "testing"} />
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text)", marginTop: "-0.5rem" }}>
            {status === "idle" && "—"}
            {status === "testing" && (liveValue === null ? <i className="ti ti-loader-2 spin" style={{ fontSize: "1.4rem" }} /> : `${liveValue} ${liveSpec.unit}`)}
          </div>
        </div>
      )}

      {done && status !== "error" && (
        <div className="stats-grid" style={{ marginBottom: "1.25rem" }}>
          {PHASE_ORDER.map((p) => {
            const spec = PHASE_GAUGE[p];
            const value = p === "download" ? download : p === "upload" ? upload : latency;
            const good = value !== null && isGood(value, spec);
            return (
              <div key={p} className="stat-card">
                <i className={`ti ${spec.icon}`} style={{ color: value === null ? undefined : good ? "var(--green)" : "var(--red)" }} />
                <div className="stat-label">{spec.label}</div>
                <div className="stat-val">{value === null ? "N/A" : `${value} ${spec.unit}`}</div>
              </div>
            );
          })}
        </div>
      )}

      {status === "idle" && (
        <div className="info-box">
          <i className="ti ti-info-circle" />
          <span>Click below when you're ready — the test takes about 25 seconds: ~10s measuring download speed, ~10s upload speed, then latency.</span>
        </div>
      )}

      {isLocalhost && status === "done" && (
        <div className="info-box">
          <i className="ti ti-info-circle" />
          <span>You're running on <strong>localhost</strong> — this reading reflects your local machine, not a real internet speed test. It'll be meaningful once this app is deployed.</span>
        </div>
      )}

      {status !== "idle" && (
        <div className={`face-check-status face-check-status--${status === "testing" ? "checking" : passed ? "ok" : "bad"}`}>
          {status === "testing" ? (
            <><i className="ti ti-loader-2 spin" /> Measuring your {liveSpec.label.toLowerCase()}…</>
          ) : status === "error" ? (
            <><i className="ti ti-alert-triangle" /> Couldn't measure your connection. You can still continue.</>
          ) : passed ? (
            <><i className="ti ti-circle-check" /> Your connection looks good.</>
          ) : (
            <><i className="ti ti-alert-triangle" /> Your download speed is below the recommended {MIN_MBPS} Mbps — the interview may lag or recordings may suffer.</>
          )}
        </div>
      )}

      {status === "idle" && (
        <button className="btn-primary" onClick={start} style={{ marginTop: "1rem", width: "100%", justifyContent: "center" }}>
          <i className="ti ti-player-play" /> Start Speed Test
        </button>
      )}

      {done && (
        <button className="btn-primary" onClick={onContinue} style={{ marginTop: "1rem", width: "100%", justifyContent: "center" }}>
          {slow ? "Continue Anyway →" : "Continue →"}
        </button>
      )}
    </div>
  );
}

const CHECK_CAPTIONS: Record<string, string> = {
  checking: "Checking your face and surroundings…",
  no_face: "We can't see your face. Please make sure you're facing the camera.",
  multiple_faces: "More than one person is visible. Only the candidate should be in frame.",
  phone_detected: "We noticed a phone or object near your face. Please put it away.",
  ok: "Looks good! Click Continue when you're ready.",
  unavailable: "Face check unavailable — continuing anyway.",
};

function FaceVerifyView({ webcamStream, onVerified }: { webcamStream: MediaStream; onVerified: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Detection itself always runs automatically — only *proceeding* once it succeeds is manual.
  const { status } = usePreInterviewCheck({ active: true, videoRef });

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = webcamStream;
  }, [webcamStream]);

  const isGood = status === "ok" || status === "unavailable";
  const isBad = status === "no_face" || status === "multiple_faces" || status === "phone_detected";

  return (
    <div className="card">
      <div className="badge">
        <i className="ti ti-scan" /> Step 1 of 2 — Verifying
      </div>
      <h1 className="heading" style={{ fontSize: "1.6rem" }}>Checking Your Camera</h1>
      <p className="sub">Make sure your face is clearly visible and you're the only person in frame.</p>

      <div className="face-check-preview">
        <video ref={videoRef} autoPlay muted playsInline className="face-check-video" />
        <div className={`face-check-ring face-check-ring--${isGood ? "ok" : isBad ? "bad" : "checking"}`} />
      </div>

      <div className={`face-check-status face-check-status--${isGood ? "ok" : isBad ? "bad" : "checking"}`}>
        {isGood ? <i className="ti ti-circle-check" /> : isBad ? <i className="ti ti-alert-triangle" /> : <i className="ti ti-loader-2 spin" />}
        {CHECK_CAPTIONS[status]}
      </div>

      {/* Manual only — detection succeeding never auto-advances on its own */}
      <button
        className="btn-primary"
        onClick={onVerified}
        disabled={!isGood}
        style={{ marginTop: "1rem", width: "100%", justifyContent: "center", opacity: isGood ? 1 : 0.6 }}
      >
        {isGood ? "Continue →" : "Waiting for a clear view of your face…"}
      </button>
    </div>
  );
}

interface PermissionsStepProps {
  onReady: (streams: Streams) => void;
}

const PERMS = [
  { id: "screen", icon: "ti-device-desktop", label: "Screen Share + System Audio", desc: "Select your entire screen — include system audio when prompted" },
  { id: "webcam", icon: "ti-camera", label: "Webcam", desc: "Face monitoring throughout interview" },
  { id: "mic", icon: "ti-microphone", label: "Microphone", desc: "Voice recording + live transcription" },
];

function PrePickerModal({
  onProceed,
  onCancel,
  showAudioWarning,
}: {
  onProceed: () => void;
  onCancel: () => void;
  showAudioWarning: boolean;
}) {
  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title">
            <i className="ti ti-device-desktop" />
            Screen Share — Follow These Steps
          </div>
          <button className="modal-close" onClick={onCancel}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="modal-body">
          {showAudioWarning && (
            <div className="error-box" style={{ marginBottom: 0 }}>
              <i className="ti ti-volume-off" style={{ fontSize: 16, flexShrink: 0 }} />
              <span>
                Previous attempt had <strong>no system audio</strong>. Make sure to check{" "}
                <strong>"Also share system audio"</strong> in step 2 below.
              </span>
            </div>
          )}

          {/* Step 1 */}
          <div>
            <div className="picker-step-label">
              <span className="picker-step-num">1</span>
              Choose <strong>"Entire Screen"</strong> tab
            </div>
            <div className="picker-diagram">
              <div className="picker-tabs">
                {[
                  { label: "Chrome Tab", active: false },
                  { label: "Window", active: false },
                  { label: "Entire Screen", active: true },
                ].map((tab) => (
                  <div
                    key={tab.label}
                    className={`picker-tab ${tab.active ? "active" : ""}`}
                  >
                    {tab.label}
                    {tab.active && <i className="ti ti-check" style={{ marginLeft: 5, fontSize: 10 }} />}
                  </div>
                ))}
              </div>
              <div className="picker-preview">
                <i className="ti ti-device-desktop" style={{ fontSize: 28, color: "var(--indigo-light)" }} />
                <span style={{ fontSize: 11, color: "var(--indigo-light)", marginTop: 6 }}>Your Entire Screen</span>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div>
            <div className="picker-step-label">
              <span className="picker-step-num">2</span>
              Check <strong>"Also share system audio"</strong>
            </div>
            <div className="picker-audio-row">
              <div className="picker-checkbox">
                <i className="ti ti-check" style={{ fontSize: 10, color: "#fff" }} />
              </div>
              <span style={{ fontSize: 12, color: "var(--text)" }}>Also share system audio</span>
              <span className="picker-required-tag">
                <i className="ti ti-alert-circle" style={{ fontSize: 11 }} /> Required
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn-outline" onClick={onCancel}>Cancel</button>
            <button className="btn-primary" onClick={onProceed}>
              <i className="ti ti-device-desktop" /> Open Screen Picker →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function isLive(stream: MediaStream | null, kind: "video" | "audio") {
  if (!stream) return false;
  const tracks = kind === "video" ? stream.getVideoTracks() : stream.getAudioTracks();
  return tracks.length > 0 && tracks[0].readyState === "live";
}

export function PermissionsStep({ onReady }: PermissionsStepProps) {
  const [granted, setGranted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [screenError, setScreenError] = useState<"wrong_surface" | "no_audio" | null>(null);
  const [showPrePicker, setShowPrePicker] = useState(false);
  const [readyStreams, setReadyStreams] = useState<Streams | null>(null);
  const [speedCheckDone, setSpeedCheckDone] = useState(false);

  // Holds streams that were already successfully acquired — reused on retry
  const streamsRef = useRef<Streams>({ screen: null, webcam: null, mic: null });

  function handleStartClick() {
    setError("");
    setScreenError(null);
    setShowPrePicker(true);
  }

  async function requestScreen() {
    setShowPrePicker(false);
    setError("");
    setLoading(true);

    try {
      // Screen — always re-request if not live (verification failures stop the tracks)
      let screenStream = streamsRef.current.screen;
      if (!isLive(screenStream, "video")) {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "monitor" } as MediaTrackConstraints,
          audio: true,
        });

        const videoTrack = screenStream.getVideoTracks()[0];
        const surface = (videoTrack?.getSettings() as any)?.displaySurface;
        if (surface && surface !== "monitor") {
          screenStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
          streamsRef.current.screen = null;
          setScreenError("wrong_surface");
          setLoading(false);
          return;
        }

        if (screenStream.getAudioTracks().length === 0) {
          screenStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
          streamsRef.current.screen = null;
          setScreenError("no_audio");
          setLoading(false);
          return;
        }

        streamsRef.current.screen = screenStream;
        setGranted((g) => ({ ...g, screen: true }));
        setScreenError(null);
      }

      // Webcam — reuse if already live, otherwise request
      let webcamStream = streamsRef.current.webcam;
      if (!isLive(webcamStream, "video")) {
        webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: false,
        });
        streamsRef.current.webcam = webcamStream;
        setGranted((g) => ({ ...g, webcam: true }));
      }

      // Mic — reuse if already live, otherwise request
      let micStream = streamsRef.current.mic;
      if (!isLive(micStream, "audio")) {
        micStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
        });
        streamsRef.current.mic = micStream;
        setGranted((g) => ({ ...g, mic: true }));
      }

      const s = { screen: screenStream!, webcam: webcamStream!, mic: micStream! };
      setTimeout(() => setReadyStreams(s), 600);
    } catch (e: any) {
      if (e.name === "NotAllowedError" || e.name === "AbortError") {
        setError("Permission denied or cancelled. Please try again.");
      } else {
        setError(e.message || "Permission denied. Please allow all requested access.");
      }
    } finally {
      setLoading(false);
    }
  }

  const hasError = screenError !== null || error !== "";

  if (readyStreams && !speedCheckDone) {
    return <SpeedCheckView onContinue={() => setSpeedCheckDone(true)} />;
  }

  if (readyStreams && speedCheckDone) {
    return (
      <FaceVerifyView
        webcamStream={readyStreams.webcam!}
        onVerified={() => onReady(readyStreams)}
      />
    );
  }

  return (
    <>
      {showPrePicker && (
        <PrePickerModal
          onProceed={requestScreen}
          onCancel={() => setShowPrePicker(false)}
          showAudioWarning={screenError === "no_audio"}
        />
      )}

      <div className="card">
        <div className="badge">
          <i className="ti ti-shield-lock" /> Step 1 of 2 — Permissions
        </div>
        <h1 className="heading" style={{ fontSize: "1.6rem" }}>Grant Required Access</h1>
        <p className="sub">
          Click <strong>"Grant All & Start"</strong> — your browser will ask for each permission in sequence.
          For screen share, select <strong>Entire Screen</strong> and enable <strong>Share system audio</strong>.
        </p>

        <div className="perm-list">
          {PERMS.map((p) => (
            <div key={p.id} className={`perm-row ${granted[p.id] ? "granted" : ""}`}>
              <div className="perm-icon">
                <i className={`ti ${p.icon}`} />
              </div>
              <div className="perm-info">
                <div className="perm-label">{p.label}</div>
                <div className="perm-desc">{p.desc}</div>
              </div>
              <div className="perm-status">
                {granted[p.id]
                  ? <i className="ti ti-circle-check status-icon granted" />
                  : loading
                  ? <i className="ti ti-loader-2 spin status-icon" />
                  : <i className="ti ti-circle-dashed status-icon" />}
              </div>
            </div>
          ))}
        </div>

        {screenError === "wrong_surface" && (
          <div className="error-box" style={{ marginBottom: "1rem" }}>
            <i className="ti ti-layout-2" style={{ fontSize: 16, flexShrink: 0 }} />
            <div>
              <strong>Wrong selection:</strong> You picked a Tab or Window. Only{" "}
              <strong>Entire Screen</strong> is allowed. Click retry and select the correct option.
            </div>
          </div>
        )}

        {screenError === "no_audio" && (
          <div className="error-box" style={{ marginBottom: "1rem" }}>
            <i className="ti ti-volume-off" style={{ fontSize: 16, flexShrink: 0 }} />
            <div>
              <strong>System audio missing:</strong> You must check{" "}
              <strong>"Also share system audio"</strong> in the screen picker. Re-share your
              screen with audio enabled to continue.
            </div>
          </div>
        )}

        {error && (
          <div className="error-box" style={{ marginBottom: "1rem" }}>
            <i className="ti ti-alert-circle" style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        <div className="screen-tip">
          <i className="ti ti-bulb" />
          <div>
            <strong>Important:</strong> When the screen picker opens, choose <em>Entire Screen</em>{" "}
            (not a tab or window) and check <em>"Also share system audio"</em> for full audio capture.
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleStartClick}
          disabled={loading}
          style={{ marginTop: "1rem" }}
        >
          {loading ? (
            <><i className="ti ti-loader-2 spin" /> Requesting permissions…</>
          ) : hasError ? (
            <><i className="ti ti-refresh" /> Retry Screen Share →</>
          ) : (
            "Grant All & Start Interview →"
          )}
        </button>
      </div>
    </>
  );
}

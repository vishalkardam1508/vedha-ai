"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { icon: "ti-player-stop", label: "Stopping all recordings…" },
  { icon: "ti-layers-union", label: "Finalizing per-question videos…" },
  { icon: "ti-file-text", label: "Compiling transcripts…" },
  { icon: "ti-json", label: "Building interview report…" },
];

export function ProcessingStep({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (current < STEPS.length) {
      const t = setTimeout(() => setCurrent((c) => c + 1), 800);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(onDone, 400);
      return () => clearTimeout(t);
    }
  }, [current, onDone]);

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="processing-spinner">
        <i className="ti ti-loader-2 spin-slow" style={{ fontSize: "40px", color: "var(--indigo)" }} />
      </div>
      <h2 className="heading" style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>Processing Interview</h2>
      <p className="sub" style={{ marginBottom: "2rem" }}>Please wait while we finalise your session.</p>
      <div className="processing-steps">
        {STEPS.map((s, i) => (
          <div key={i} className={`processing-step ${i < current ? "done" : i === current ? "active" : ""}`}>
            <div className="proc-icon">
              {i < current
                ? <i className="ti ti-check" style={{ color: "var(--green)" }} />
                : <i className={`ti ${s.icon}`} />}
            </div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

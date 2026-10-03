"use client";

import { useEffect, useState } from "react";
import SpeedTest from "@cloudflare/speedtest";

export type SpeedCheckStatus = "idle" | "testing" | "done" | "error";
export type SpeedPhase = "download" | "upload" | "latency";

interface UseConnectionSpeedResult {
  status: SpeedCheckStatus;
  phase: SpeedPhase;
  download: number | null; // Mbps
  upload: number | null; // Mbps
  latency: number | null; // ms
  isLocalhost: boolean;
  start: () => void;
}

// Sequenced explicitly (download -> upload -> latency) so the UI can show one metric at a
// time in that order — the library's own default config interleaves latency first, which
// isn't what we want here.
const MEASUREMENTS = [
  { type: "download" as const, bytes: 1e5, count: 6 },
  { type: "download" as const, bytes: 1e6, count: 6 },
  { type: "download" as const, bytes: 1e7, count: 4 },
  { type: "upload" as const, bytes: 1e5, count: 6 },
  { type: "upload" as const, bytes: 1e6, count: 4 },
  { type: "latency" as const, numPackets: 20 },
];

// The real measurement for a phase often finishes in well under a second on a fast
// connection. These are floors, not caps — a slow connection can still take longer — but on
// a fast one we deliberately stay on this phase, animating the gauge toward the real reading
// over the whole window, so it reads as a proper speedometer sweep rather than the number
// popping in instantly and then sitting frozen for several seconds (which looked broken).
const MIN_PHASE_MS: Record<SpeedPhase, number> = {
  download: 10000,
  upload: 10000,
  latency: 4000,
};

function toMbps(bps: number | undefined): number | null {
  if (typeof bps !== "number" || !(bps > 0)) return null;
  return Math.round((bps / 1_000_000) * 10) / 10;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useConnectionSpeed(): UseConnectionSpeedResult {
  const [status, setStatus] = useState<SpeedCheckStatus>("idle");
  const [phase, setPhase] = useState<SpeedPhase>("download");
  const [download, setDownload] = useState<number | null>(null);
  const [upload, setUpload] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [runId, setRunId] = useState(0);
  const isLocalhost =
    typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

  const start = () => {
    setStatus("testing");
    setPhase("download");
    setDownload(null);
    setUpload(null);
    setLatency(null);
    setRunId((r) => r + 1);
  };

  useEffect(() => {
    if (runId === 0) return; // don't auto-run — wait for start()

    let cancelled = false;
    let holdTimeout: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;

    // The logical phase currently shown on screen, and when it started — distinct from
    // `measurement.type` on each onPhaseChange event, since MEASUREMENTS has multiple
    // ramp-up rounds per direction (e.g. 3 download entries) that all share one logical phase.
    let currentPhase: SpeedPhase | null = null;
    let phaseStartedAt = 0;

    // Real values as reported by the engine — the source of truth for pass/fail and for the
    // exact number the gauge settles on when a phase ends.
    const real: Record<SpeedPhase, number | null> = { download: null, upload: null, latency: null };
    // What's actually rendered — eased toward `real` over the phase's minimum duration so the
    // needle is continuously moving instead of jumping straight to the final reading.
    const shown: Record<SpeedPhase, number | null> = { download: null, upload: null, latency: null };

    const engine = new SpeedTest({
      autoStart: false,
      measurements: MEASUREMENTS,
      measureDownloadLoadedLatency: false,
      measureUploadLoadedLatency: false,
      // Keep the test fully client-side — don't ship a real candidate's connection
      // telemetry to Cloudflare's aggregate-stats endpoint.
      logAimApiUrl: null,
    });

    const setShown = (p: SpeedPhase, value: number | null) => {
      shown[p] = value;
      if (p === "download") setDownload(value);
      else if (p === "upload") setUpload(value);
      else setLatency(value);
    };

    const readReal = () => {
      if (cancelled) return;
      real.download = toMbps(engine.results.getDownloadBandwidth());
      real.upload = toMbps(engine.results.getUploadBandwidth());
      const latencyMs = engine.results.getUnloadedLatency();
      real.latency = typeof latencyMs === "number" ? Math.round(latencyMs) : null;
    };

    // Continuously eases the visible number toward the latest real reading for whichever
    // phase is active, across the whole minimum-duration window — runs the whole time the
    // test is active, not just while the engine itself is doing network work, which is what
    // keeps the gauge visibly moving during the hold after a fast connection's real result
    // already came in.
    const animate = () => {
      if (cancelled) return;
      const p = currentPhase;
      const target = p ? real[p] : null;
      if (p && target !== null) {
        const t = Math.min(1, (performance.now() - phaseStartedAt) / MIN_PHASE_MS[p]);
        const nextValue = Math.round(target * easeOutCubic(t) * 10) / 10;
        if (shown[p] !== nextValue) setShown(p, nextValue);
      }
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    engine.onPhaseChange = ({ measurement }) => {
      if (cancelled) return;
      const type = measurement.type;
      if (type !== "download" && type !== "upload" && type !== "latency") return;

      if (currentPhase === null) {
        // Very first measurement round of the whole test.
        currentPhase = type;
        phaseStartedAt = performance.now();
        setPhase(type);
        setShown(type, 0); // show "0" immediately, not a spinner, while the first sample is pending
        return;
      }
      if (type === currentPhase) return; // next ramp-up round within the same logical phase

      // The engine is moving on to a new logical phase — hold here until this phase has
      // been visible for at least its minimum duration before revealing the next one.
      const finishedPhase = currentPhase;
      const elapsed = performance.now() - phaseStartedAt;
      const remaining = MIN_PHASE_MS[finishedPhase] - elapsed;
      const advance = () => {
        if (cancelled) return;
        // Snap to the exact real value before moving on, so the finished gauge never lands
        // a fraction short of the true reading.
        if (real[finishedPhase] !== null) setShown(finishedPhase, real[finishedPhase]);
        currentPhase = type;
        phaseStartedAt = performance.now();
        real[type] = null; // the new phase hasn't reported anything yet, regardless of stale prior runs
        setPhase(type);
        setShown(type, 0); // new phase starts visibly at zero, not wherever the last phase's needle ended
        engine.play();
      };
      if (remaining > 0) {
        engine.pause();
        holdTimeout = setTimeout(advance, remaining);
      } else {
        advance();
      }
    };

    engine.onResultsChange = () => readReal();

    engine.onFinish = () => {
      if (cancelled) return;
      readReal();
      const elapsed = currentPhase ? performance.now() - phaseStartedAt : 0;
      const remaining = (currentPhase ? MIN_PHASE_MS[currentPhase] : 0) - elapsed;
      const reveal = () => {
        if (cancelled) return;
        if (currentPhase && real[currentPhase] !== null) setShown(currentPhase, real[currentPhase]);
        setStatus("done");
      };
      if (remaining > 0) {
        holdTimeout = setTimeout(reveal, remaining);
      } else {
        reveal();
      }
    };

    engine.onError = (message) => {
      if (cancelled) return;
      console.error("[useConnectionSpeed] Speed test failed:", message);
      setStatus("error");
    };

    engine.play();

    return () => {
      cancelled = true;
      if (holdTimeout) clearTimeout(holdTimeout);
      if (rafId !== null) cancelAnimationFrame(rafId);
      engine.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return { status, phase, download, upload, latency, isLocalhost, start };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { getTimestamp } from "@/lib/utils";
import { WARNING_MESSAGES } from "@/lib/constants";
import { sampleBackgroundLuminance } from "@/lib/backgroundSample";

export type BackgroundStatus = "initializing" | "stable" | "changed" | "unavailable";

interface UseBackgroundMonitorOptions {
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onViolation: (type: "BACKGROUND_CHANGED", message: string, timestamp: string) => void;
}

const CHECK_INTERVAL_MS = 2000; // background doesn't need face/phone's faster reaction time
const BASELINE_GRACE_MS = 3000; // let the camera's autofocus/auto-exposure settle first
const CHANGE_THRESHOLD = 18; // mean abs luminance diff (0-255) vs baseline that counts as "changed"
const DEBOUNCE_MS = 2500; // require sustained change so a passing shadow/flicker doesn't fire
const MAX_BASELINE_ATTEMPTS = 15; // ~30s of retries before giving up and reporting "unavailable"

export function useBackgroundMonitor({ active, videoRef, onViolation }: UseBackgroundMonitorOptions): { status: BackgroundStatus } {
  const [status, setStatus] = useState<BackgroundStatus>("initializing");

  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const canvas = document.createElement("canvas");
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let baseline: number[] | null = null;
    let baselineAttempts = 0;
    let pendingSince: number | null = null;
    let fired = false;
    const startedAt = performance.now();

    intervalId = setInterval(() => {
      if (cancelled) return;
      const videoEl = videoRef.current;
      if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) return;

      if (!baseline) {
        // Give the camera a moment to settle (autofocus/auto-exposure) before locking in a
        // baseline — the very first frames right after the stream starts can look different
        // from what it settles to a second later.
        if (performance.now() - startedAt < BASELINE_GRACE_MS) return;

        baseline = sampleBackgroundLuminance(videoEl, canvas);
        if (baseline) {
          setStatus("stable");
        } else {
          // Retried every tick instead of a single one-shot attempt — a one-shot attempt that
          // happened to land before the video was truly ready (readyState can flip to "ready
          // enough" before a real frame has actually been decoded yet) used to permanently
          // disable this feature for the rest of the interview with no way to recover.
          baselineAttempts++;
          if (baselineAttempts >= MAX_BASELINE_ATTEMPTS) setStatus("unavailable");
        }
        return; // this tick only ever establishes the baseline; comparisons start next tick
      }

      const current = sampleBackgroundLuminance(videoEl, canvas);
      if (!current || current.length !== baseline.length) return;

      let sum = 0;
      for (let i = 0; i < current.length; i++) sum += Math.abs(current[i] - baseline[i]);
      const meanDiff = sum / current.length;
      const now = Date.now();

      if (meanDiff <= CHANGE_THRESHOLD) {
        pendingSince = null;
        fired = false;
        setStatus("stable");
        return;
      }

      if (pendingSince === null) {
        pendingSince = now;
        console.info(`[useBackgroundMonitor] Noticed a background change (meanDiff=${meanDiff.toFixed(1)}) — confirming over ${DEBOUNCE_MS}ms before flagging.`);
      }

      if (fired) {
        setStatus("changed");
        return;
      }

      if (now - pendingSince >= DEBOUNCE_MS) {
        fired = true;
        setStatus("changed");
        console.info("[useBackgroundMonitor] Firing BACKGROUND_CHANGED after sustained change.");
        onViolationRef.current("BACKGROUND_CHANGED", WARNING_MESSAGES.BACKGROUND_CHANGED, getTimestamp());
        // Re-baseline to the new, now-sustained background — this flags the *event* of a
        // change (someone walking in, a big shift), not a permanently different environment
        // for the rest of the interview.
        baseline = current;
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [active, videoRef]);

  return { status };
}

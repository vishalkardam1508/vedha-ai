"use client";

import { useEffect, useRef, useState } from "react";
import { getTimestamp } from "@/lib/utils";
import { WARNING_MESSAGES } from "@/lib/constants";

export type FaceStatus = "initializing" | "ok" | "missing" | "multiple" | "unavailable";

type Incident = "missing" | "multiple";

interface UseFaceMonitorOptions {
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onViolation: (type: "FACE_MISSING" | "MULTIPLE_FACES", message: string, timestamp: string) => void;
}

const DETECT_INTERVAL_MS = 400;
const MISSING_DEBOUNCE_MS = 3000;
const MULTIPLE_DEBOUNCE_MS = 1500;

export function useFaceMonitor({ active, videoRef, onViolation }: UseFaceMonitorOptions): { status: FaceStatus } {
  const [status, setStatus] = useState<FaceStatus>("initializing");

  const activeRef = useRef(active);
  activeRef.current = active;
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let detector: { detectForVideo: (v: HTMLVideoElement, t: number) => { detections: unknown[] }; close: () => void } | null = null;

    const pendingRef: { current: { type: Incident; since: number } | null } = { current: null };
    const firedRef: { current: Incident | null } = { current: null };
    const lastVideoTimeRef: { current: number } = { current: -1 };

    async function init() {
      try {
        const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
        const filesetResolver = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        if (cancelled) return;

        const created = await FaceDetector.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "/mediapipe/models/blaze_face_full_range.tflite",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          // Tuned down twice now (0.5 -> 0.3 -> 0.2) — a background person is smaller, often at
          // an angle, and sometimes partially out of frame, all of which lower the model's own
          // confidence well below what a clean, centered, front-facing candidate face scores.
          minDetectionConfidence: 0.2,
        });
        if (cancelled) {
          created.close();
          return;
        }
        detector = created;
        setStatus("ok");
        console.info("[useFaceMonitor] Face detector initialized — monitoring active.");

        intervalId = setInterval(() => {
          if (!activeRef.current || !detector) return;
          const videoEl = videoRef.current;
          if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) return;

          // Skip if no new decoded frame (e.g. the camera track was fully stopped) — avoids
          // firing FACE_MISSING for the same root cause CAMERA_DISABLED already reports.
          if (videoEl.currentTime === lastVideoTimeRef.current) return;
          lastVideoTimeRef.current = videoEl.currentTime;

          let count: number;
          try {
            const result = detector.detectForVideo(videoEl, performance.now());
            count = result.detections.length;
          } catch (err) {
            console.error("[useFaceMonitor] detectForVideo failed on this frame:", err);
            return; // skip this tick, try again next interval rather than breaking the loop
          }
          const now = Date.now();

          if (count === 1) {
            pendingRef.current = null;
            firedRef.current = null;
            setStatus("ok");
            return;
          }

          const kind: Incident = count === 0 ? "missing" : "multiple";
          const threshold = kind === "missing" ? MISSING_DEBOUNCE_MS : MULTIPLE_DEBOUNCE_MS;

          if (pendingRef.current?.type !== kind) {
            pendingRef.current = { type: kind, since: now };
            // Logged the moment it's first noticed, not just when the strike actually fires —
            // if this never appears in the console while a second person is clearly in frame,
            // the model genuinely isn't seeing them (camera FOV/distance/angle), not a debounce
            // delay; if it does appear but the strike never follows, they're stepping in and
            // out of frame faster than the 1.5s sustained-presence requirement.
            console.info(`[useFaceMonitor] Noticed ${kind} (face count=${count}) — confirming over ${threshold}ms before flagging.`);
          }

          if (firedRef.current === kind) {
            setStatus(kind);
            return;
          }

          if (now - pendingRef.current.since >= threshold) {
            firedRef.current = kind;
            setStatus(kind);
            const type = kind === "missing" ? "FACE_MISSING" : "MULTIPLE_FACES";
            console.info(`[useFaceMonitor] Firing ${type} (face count=${count}) after ${threshold}ms sustained.`);
            onViolationRef.current(type, WARNING_MESSAGES[type], getTimestamp());
          }
        }, DETECT_INTERVAL_MS);
      } catch (err) {
        // Assets unavailable / detector failed to initialize — fail open, never block the interview.
        console.error("[useFaceMonitor] Failed to initialize face detector — face monitoring disabled:", err);
        if (!cancelled) setStatus("unavailable");
      }
    }

    init();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      detector?.close();
    };
  }, [active, videoRef]);

  return { status };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { getTimestamp } from "@/lib/utils";
import { WARNING_MESSAGES } from "@/lib/constants";

export type ObjectStatus = "initializing" | "clear" | "detected" | "unavailable";

interface UseObjectMonitorOptions {
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onViolation: (type: "PHONE_DETECTED", message: string, timestamp: string) => void;
}

const DETECT_INTERVAL_MS = 800; // a phone held up doesn't need face-loss's 400ms reaction time
const DEBOUNCE_MS = 900; // require sustained detection so a hand passing through frame doesn't fire
// Lightweight COCO detectors are trained on "phone visible in a normal photo" — held right up
// against the camera, or only half in frame at the edge, it doesn't look like the full phone
// shape the model expects and its confidence score drops. Tuned down twice now (0.5 -> 0.3 ->
// 0.2) to catch partial views; the area filter below (only count large-in-frame detections)
// is what keeps a phone glimpsed on a desk in the background from ever counting as "covering
// the face", so we can afford to be loose on confidence here.
const SCORE_THRESHOLD = 0.2;
const MIN_AREA_FRACTION = 0.03; // detection's bounding box must cover at least 3% of the frame
// A remote looks a lot like a phone (similar size/rectangular shape), and a half-visible phone
// is sometimes misclassified as one — allow it too as a secondary signal for held objects.
const ALLOWED_CATEGORIES = ["cell phone", "remote"];

interface DetectionBox {
  boundingBox?: { width: number; height: number };
}

export function useObjectMonitor({ active, videoRef, onViolation }: UseObjectMonitorOptions): { status: ObjectStatus } {
  const [status, setStatus] = useState<ObjectStatus>("initializing");

  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let detector: { detectForVideo: (v: HTMLVideoElement, t: number) => { detections: DetectionBox[] }; close: () => void } | null = null;

    let pendingSince: number | null = null;
    let fired = false;
    let lastVideoTime = -1;

    async function init() {
      try {
        const { FilesetResolver, ObjectDetector } = await import("@mediapipe/tasks-vision");
        const filesetResolver = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        if (cancelled) return;

        const created = await ObjectDetector.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "/mediapipe/models/efficientdet_lite0.tflite",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          categoryAllowlist: ALLOWED_CATEGORIES,
          scoreThreshold: SCORE_THRESHOLD,
        });
        if (cancelled) {
          created.close();
          return;
        }
        detector = created;
        setStatus("clear");
        console.info("[useObjectMonitor] Object detector initialized — phone monitoring active.");

        intervalId = setInterval(() => {
          if (!active || !detector) return;
          const videoEl = videoRef.current;
          if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) return;
          if (videoEl.currentTime === lastVideoTime) return;
          lastVideoTime = videoEl.currentTime;

          let count: number;
          try {
            const frameArea = videoEl.videoWidth * videoEl.videoHeight;
            const detections = detector.detectForVideo(videoEl, performance.now()).detections;
            count = detections.filter((d) => {
              const box = d.boundingBox;
              if (!box) return true; // no box info — don't silently drop a real detection
              return (box.width * box.height) / frameArea >= MIN_AREA_FRACTION;
            }).length;
          } catch (err) {
            console.error("[useObjectMonitor] detectForVideo failed on this frame:", err);
            return;
          }
          const now = Date.now();

          if (count === 0) {
            pendingSince = null;
            fired = false;
            setStatus("clear");
            return;
          }

          if (pendingSince === null) pendingSince = now;

          if (fired) {
            setStatus("detected");
            return;
          }

          if (now - pendingSince >= DEBOUNCE_MS) {
            fired = true;
            setStatus("detected");
            console.info("[useObjectMonitor] Firing PHONE_DETECTED after sustained detection.");
            onViolationRef.current("PHONE_DETECTED", WARNING_MESSAGES.PHONE_DETECTED, getTimestamp());
          }
        }, DETECT_INTERVAL_MS);
      } catch (err) {
        // Assets unavailable / detector failed to initialize — fail open, never block the interview.
        console.error("[useObjectMonitor] Failed to initialize object detector — phone monitoring disabled:", err);
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

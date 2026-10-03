"use client";

import { useEffect, useState } from "react";

export type PreCheckStatus = "checking" | "no_face" | "multiple_faces" | "phone_detected" | "ok" | "unavailable";

interface UsePreInterviewCheckOptions {
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const DETECT_INTERVAL_MS = 300;
const REQUIRED_STABLE_MS = 1200; // how long a single face (and no phone) must hold before we call it "ok"
const UNAVAILABLE_FALLBACK_MS = 8000; // never block the candidate over a vision hiccup
// See useObjectMonitor.ts for why this is tuned loose (catches a phone held close, or only
// half in frame) and why the area filter keeps a phone glimpsed in the background from
// blocking "ok".
const PHONE_SCORE_THRESHOLD = 0.2;
const PHONE_MIN_AREA_FRACTION = 0.03;
const PHONE_ALLOWED_CATEGORIES = ["cell phone", "remote"];

interface DetectionBox {
  boundingBox?: { width: number; height: number };
}

export function usePreInterviewCheck({ active, videoRef }: UsePreInterviewCheckOptions): { status: PreCheckStatus } {
  const [status, setStatus] = useState<PreCheckStatus>("checking");

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let faceDetector: { detectForVideo: (v: HTMLVideoElement, t: number) => { detections: unknown[] }; close: () => void } | null = null;
    let objectDetector: { detectForVideo: (v: HTMLVideoElement, t: number) => { detections: DetectionBox[] }; close: () => void } | null = null;
    let goodStreakMs = 0;
    let lastVideoTime = -1;

    async function init() {
      try {
        const { FilesetResolver, FaceDetector, ObjectDetector } = await import("@mediapipe/tasks-vision");
        const filesetResolver = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        if (cancelled) return;

        const [face, object] = await Promise.all([
          FaceDetector.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: "/mediapipe/models/blaze_face_full_range.tflite",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            // See useFaceMonitor.ts for why this is tuned this low.
            minDetectionConfidence: 0.2,
          }),
          ObjectDetector.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: "/mediapipe/models/efficientdet_lite0.tflite",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            categoryAllowlist: PHONE_ALLOWED_CATEGORIES,
            scoreThreshold: PHONE_SCORE_THRESHOLD,
          }),
        ]);
        if (cancelled) {
          face.close();
          object.close();
          return;
        }
        faceDetector = face;
        objectDetector = object;

        intervalId = setInterval(() => {
          if (!faceDetector || !objectDetector) return;
          const videoEl = videoRef.current;
          if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) return;
          if (videoEl.currentTime === lastVideoTime) return;
          lastVideoTime = videoEl.currentTime;

          let faceCount: number;
          let phoneCount: number;
          try {
            faceCount = faceDetector.detectForVideo(videoEl, performance.now()).detections.length;
            const frameArea = videoEl.videoWidth * videoEl.videoHeight;
            phoneCount = objectDetector.detectForVideo(videoEl, performance.now()).detections.filter((d) => {
              const box = d.boundingBox;
              if (!box) return true;
              return (box.width * box.height) / frameArea >= PHONE_MIN_AREA_FRACTION;
            }).length;
          } catch (err) {
            console.error("[usePreInterviewCheck] detectForVideo failed on this frame:", err);
            return;
          }

          if (faceCount !== 1) {
            if (faceCount > 1) console.info(`[usePreInterviewCheck] Detected ${faceCount} faces this frame.`);
            goodStreakMs = 0;
            setStatus(faceCount === 0 ? "no_face" : "multiple_faces");
            return;
          }
          if (phoneCount > 0) {
            goodStreakMs = 0;
            setStatus("phone_detected");
            return;
          }

          goodStreakMs += DETECT_INTERVAL_MS;
          if (goodStreakMs >= REQUIRED_STABLE_MS) {
            setStatus("ok");
          }
        }, DETECT_INTERVAL_MS);
      } catch (err) {
        console.error("[usePreInterviewCheck] Failed to initialize detectors:", err);
        if (!cancelled) setStatus("unavailable");
      }
    }

    init();

    // Never trap a candidate behind a broken/slow detector — fail open after a grace period.
    fallbackTimer = setTimeout(() => {
      setStatus((s) => (s === "ok" ? s : "unavailable"));
    }, UNAVAILABLE_FALLBACK_MS);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      faceDetector?.close();
      objectDetector?.close();
    };
  }, [active, videoRef]);

  return { status };
}

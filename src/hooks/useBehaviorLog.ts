"use client";

import { useEffect, useRef } from "react";
import { getTimestamp } from "@/lib/utils";

export interface BodyLogEntry {
  timestamp: string;
  questionIndex: number;
  expression: string;
  bodyCount: number;
  postureShift: boolean;
  lookingAway: boolean;
  possibleSunglasses?: boolean;
  possibleStaticImage?: boolean;
}

interface UseBehaviorLogOptions {
  active: boolean;
  questionIndex: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  onLogEntry: (entry: BodyLogEntry) => void;
}

const DETECT_INTERVAL_MS = 2500;
const EXPRESSION_CONFIDENCE = 0.5;
const POSTURE_SHIFT_DISTANCE = 0.15; // fraction of frame size
const POSTURE_SHIFT_ANGLE_DEG = 12;
const GAZE_AWAY_OUT_THRESHOLD = 0.4;
const GAZE_AWAY_MARGIN = 0.2; // "out" gaze must exceed "in" gaze by this much to count as away
const BLINK_BUFFER_SIZE = 20; // ~50s of samples at DETECT_INTERVAL_MS
const BLINK_RANGE_EPSILON = 0.05; // near-zero variation over the whole buffer => likely occluded eyes
const STATIC_BUFFER_SIZE = 10; // ~25s of samples
const STATIC_DELTA_EPSILON = 0.015; // total blendshape movement below this => essentially a still image
const BODY_COUNT_STABLE_TICKS = 2; // require 2 consecutive matching reads (~5s) before trusting a change

// categoryName -> friendly label. Blinks/eye-look are excluded — they're read directly for the
// gaze-away and sunglasses heuristics below rather than surfaced as an "expression".
const EXPRESSION_LABELS: Record<string, string> = {
  mouthSmileLeft: "smiling",
  mouthSmileRight: "smiling",
  browDownLeft: "frowning",
  browDownRight: "frowning",
  browInnerUp: "surprised",
  eyeWideLeft: "surprised",
  eyeWideRight: "surprised",
  mouthFrownLeft: "sad",
  mouthFrownRight: "sad",
  jawOpen: "mouth open",
  eyeSquintLeft: "squinting",
  eyeSquintRight: "squinting",
};

// A handful of categories whose frame-to-frame movement is checked for the "is this a live
// face, or a static photo held up to the camera" heuristic — deliberately excludes blink (its
// own, separate heuristic above) and gaze (jitters even when a person is otherwise motionless).
const LIVENESS_TRACKED_CATEGORIES = [
  "mouthSmileLeft", "mouthSmileRight", "browDownLeft", "browDownRight", "browInnerUp",
  "jawOpen", "mouthFrownLeft", "mouthFrownRight", "cheekSquintLeft", "cheekSquintRight",
];

interface Landmark {
  x: number;
  y: number;
}

interface Category {
  categoryName: string;
  score: number;
}

function getScore(categories: Category[], name: string): number {
  return categories.find((c) => c.categoryName === name)?.score ?? 0;
}

function shoulderSignature(landmarks: Landmark[]): { x: number; y: number; angle: number } | null {
  const left = landmarks[11];
  const right = landmarks[12];
  if (!left || !right) return null;
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    angle: (Math.atan2(right.y - left.y, right.x - left.x) * 180) / Math.PI,
  };
}

export function useBehaviorLog({ active, questionIndex, videoRef, onLogEntry }: UseBehaviorLogOptions): void {
  const onLogEntryRef = useRef(onLogEntry);
  onLogEntryRef.current = onLogEntry;
  // Read via ref inside the interval tick so changing questions doesn't restart the detector
  // (re-initializing the MediaPipe models every question would be wasteful and slow).
  const questionIndexRef = useRef(questionIndex);
  questionIndexRef.current = questionIndex;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let faceLandmarker: {
      detectForVideo: (v: HTMLVideoElement, t: number) => { faceBlendshapes: { categories: Category[] }[] };
      close: () => void;
    } | null = null;
    let poseLandmarker: {
      detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks: Landmark[][] };
      close: () => void;
    } | null = null;

    let lastVideoTime = -1;
    // The posture-shift reference point. Deliberately re-armed to the current position once a
    // shift has been logged, so a one-time move is flagged once — not on every tick forever
    // after (the previous version pinned this to the very first frame for the whole session).
    let baseline: { x: number; y: number; angle: number } | null = null;
    let lastLogged: {
      expression: string;
      bodyCount: number;
      postureShift: boolean;
      lookingAway: boolean;
      possibleSunglasses: boolean;
      possibleStaticImage: boolean;
    } | null = null;

    // Best-effort sunglasses heuristic: a real eye blinks periodically, producing a spike-and-
    // return pattern in this score. If the score barely moves across a long rolling window,
    // that most often means the eyes aren't actually visible to the model (e.g. sunglasses) —
    // though low light or an unusual eye shape could also produce it, hence "best-effort".
    const blinkBuffer: number[] = [];

    // Weak liveness heuristic: a real face has continuous micro-movement even sitting "still".
    // A photo held up to the camera is perfectly static. Tracks total movement across several
    // expression-relevant categories tick-to-tick; if that stays near zero for a while, it's
    // more likely a static image than a live person deliberately not moving.
    let prevLivenessCategories: Category[] | null = null;
    const staticDeltaBuffer: number[] = [];

    // Debounce for the pose model's body count — it occasionally hallucinates a second body
    // for a single frame; require the same reading twice in a row before trusting it.
    let stableBodyCount = 0;
    let pendingBodyCount: number | null = null;
    let pendingBodyCountStreak = 0;

    async function init() {
      try {
        const { FilesetResolver, FaceLandmarker, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        if (cancelled) return;

        const [face, pose] = await Promise.all([
          FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: "/mediapipe/models/face_landmarker.task", delegate: "CPU" },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true,
          }),
          PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: "/mediapipe/models/pose_landmarker_lite.task", delegate: "CPU" },
            runningMode: "VIDEO",
            numPoses: 2,
          }),
        ]);

        if (cancelled) {
          face.close();
          pose.close();
          return;
        }
        faceLandmarker = face;
        poseLandmarker = pose;
        console.info("[useBehaviorLog] Face/pose landmarkers initialized — behavior logging active.");

        intervalId = setInterval(() => {
          if (!faceLandmarker || !poseLandmarker) return;
          const videoEl = videoRef.current;
          if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) return;
          if (videoEl.currentTime === lastVideoTime) return;
          lastVideoTime = videoEl.currentTime;

          let expression = "neutral";
          let postureShift = false;
          let lookingAway = false;
          let possibleSunglasses = false;
          let possibleStaticImage = false;
          let rawBodyCount = 0;

          try {
            const now = performance.now();
            const faceResult = faceLandmarker.detectForVideo(videoEl, now);
            const categories = faceResult.faceBlendshapes[0]?.categories ?? [];

            let best: { label: string; score: number } | null = null;
            for (const cat of categories) {
              const label = EXPRESSION_LABELS[cat.categoryName];
              if (!label || cat.score < EXPRESSION_CONFIDENCE) continue;
              if (!best || cat.score > best.score) best = { label, score: cat.score };
            }
            if (best) expression = best.label;

            if (categories.length > 0) {
              const outAvg = (getScore(categories, "eyeLookOutLeft") + getScore(categories, "eyeLookOutRight")) / 2;
              const inAvg = (getScore(categories, "eyeLookInLeft") + getScore(categories, "eyeLookInRight")) / 2;
              lookingAway = outAvg > GAZE_AWAY_OUT_THRESHOLD && outAvg - inAvg > GAZE_AWAY_MARGIN;

              const blinkAvg = (getScore(categories, "eyeBlinkLeft") + getScore(categories, "eyeBlinkRight")) / 2;
              blinkBuffer.push(blinkAvg);
              if (blinkBuffer.length > BLINK_BUFFER_SIZE) blinkBuffer.shift();
              if (blinkBuffer.length === BLINK_BUFFER_SIZE) {
                const range = Math.max(...blinkBuffer) - Math.min(...blinkBuffer);
                possibleSunglasses = range < BLINK_RANGE_EPSILON;
              }

              if (prevLivenessCategories) {
                let delta = 0;
                for (const name of LIVENESS_TRACKED_CATEGORIES) {
                  delta += Math.abs(getScore(categories, name) - getScore(prevLivenessCategories, name));
                }
                staticDeltaBuffer.push(delta);
                if (staticDeltaBuffer.length > STATIC_BUFFER_SIZE) staticDeltaBuffer.shift();
                if (staticDeltaBuffer.length === STATIC_BUFFER_SIZE) {
                  possibleStaticImage = Math.max(...staticDeltaBuffer) < STATIC_DELTA_EPSILON;
                }
              }
              prevLivenessCategories = categories;
            }

            const poseResult = poseLandmarker.detectForVideo(videoEl, now);
            rawBodyCount = poseResult.landmarks.length;

            const primary = poseResult.landmarks[0];
            if (primary) {
              const signature = shoulderSignature(primary);
              if (signature) {
                if (!baseline) {
                  baseline = signature;
                } else {
                  const dx = signature.x - baseline.x;
                  const dy = signature.y - baseline.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  const angleDelta = Math.abs(signature.angle - baseline.angle);
                  postureShift = distance > POSTURE_SHIFT_DISTANCE || angleDelta > POSTURE_SHIFT_ANGLE_DEG;
                  if (postureShift) baseline = signature; // re-arm — flag a move once, not forever after
                }
              }
            }
          } catch (err) {
            console.error("[useBehaviorLog] detection failed on this frame:", err);
            return;
          }

          // A single stray frame from the pose model shouldn't count as a real change in how
          // many people are in view — require the same reading twice before trusting it.
          if (rawBodyCount === pendingBodyCount) {
            pendingBodyCountStreak++;
          } else {
            pendingBodyCount = rawBodyCount;
            pendingBodyCountStreak = 1;
          }
          if (pendingBodyCountStreak >= BODY_COUNT_STABLE_TICKS) {
            stableBodyCount = rawBodyCount;
          }
          const bodyCount = stableBodyCount;

          const changed =
            !lastLogged ||
            lastLogged.expression !== expression ||
            lastLogged.bodyCount !== bodyCount ||
            (!lastLogged.postureShift && postureShift) ||
            (!lastLogged.lookingAway && lookingAway) ||
            (!lastLogged.possibleSunglasses && possibleSunglasses) ||
            (!lastLogged.possibleStaticImage && possibleStaticImage);

          if (changed) {
            lastLogged = { expression, bodyCount, postureShift, lookingAway, possibleSunglasses, possibleStaticImage };
            onLogEntryRef.current({
              timestamp: getTimestamp(),
              questionIndex: questionIndexRef.current,
              expression,
              bodyCount,
              postureShift,
              lookingAway,
              possibleSunglasses,
              possibleStaticImage,
            });
          }
        }, DETECT_INTERVAL_MS);
      } catch (err) {
        console.error("[useBehaviorLog] Failed to initialize face/pose landmarkers — behavior logging disabled:", err);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      faceLandmarker?.close();
      poseLandmarker?.close();
    };
  }, [active, videoRef]);
}

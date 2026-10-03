import { existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const wasmSrc = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmDest = join(root, "public", "mediapipe", "wasm");
const modelDest = join(root, "public", "mediapipe", "models");

const MODELS = [
  {
    // "full_range" (not "short_range") on purpose — short_range is tuned for a single close-up
    // selfie-distance face and misses smaller, farther-away faces, which is exactly what a
    // second person sitting in the background of the frame looks like.
    name: "face detector",
    url: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite",
    file: "blaze_face_full_range.tflite",
  },
  {
    name: "pose landmarker",
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    file: "pose_landmarker_lite.task",
  },
  {
    name: "face landmarker",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    file: "face_landmarker.task",
  },
  {
    name: "object detector",
    url: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
    file: "efficientdet_lite0.tflite",
  },
];

function copyWasm() {
  if (!existsSync(wasmSrc)) {
    console.warn("[setup-vision-assets] @mediapipe/tasks-vision wasm folder not found, skipping copy.");
    return;
  }
  mkdirSync(wasmDest, { recursive: true });
  for (const file of readdirSync(wasmSrc)) {
    copyFileSync(join(wasmSrc, file), join(wasmDest, file));
  }
  console.log("[setup-vision-assets] Copied MediaPipe WASM runtime to public/mediapipe/wasm");
}

async function downloadModel({ name, url, file }) {
  const modelPath = join(modelDest, file);
  if (existsSync(modelPath)) {
    console.log(`[setup-vision-assets] ${name} model already present, skipping download.`);
    return;
  }
  mkdirSync(modelDest, { recursive: true });
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(modelPath, buffer);
    console.log(`[setup-vision-assets] Downloaded ${name} model to public/mediapipe/models`);
  } catch (err) {
    console.warn(
      `[setup-vision-assets] Could not download ${name} model (${err.message}). ` +
        "The related feature will fail open at runtime, but the app still works."
    );
  }
}

copyWasm();
for (const model of MODELS) {
  await downloadModel(model);
}

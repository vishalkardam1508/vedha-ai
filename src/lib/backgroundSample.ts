// Shared canvas-sampling groundwork used by both the pre-interview "is this background busy"
// check (usePreInterviewCheck) and the live "has the background changed" monitor
// (useBackgroundMonitor). Samples only the periphery of the frame — the candidate's face is
// normally centered, so this is a cheap proxy for "what's behind them" without needing to
// exclude the exact face bounding box.
const SAMPLE_W = 64;
const SAMPLE_H = 48;
const MARGIN_X_FRAC = 0.28;
const MARGIN_Y_FRAC = 0.22;

export function sampleBackgroundLuminance(video: HTMLVideoElement, canvas: HTMLCanvasElement): number[] | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
  } catch {
    return null; // e.g. a tainted canvas — fail open, never block on this
  }

  const marginX = Math.floor(SAMPLE_W * MARGIN_X_FRAC);
  const marginY = Math.floor(SAMPLE_H * MARGIN_Y_FRAC);
  const lum: number[] = [];
  for (let y = 0; y < SAMPLE_H; y++) {
    for (let x = 0; x < SAMPLE_W; x++) {
      const isPeriphery = x < marginX || x >= SAMPLE_W - marginX || y < marginY || y >= SAMPLE_H - marginY;
      if (!isPeriphery) continue;
      const i = (y * SAMPLE_W + x) * 4;
      lum.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
  }
  return lum.length > 0 ? lum : null;
}

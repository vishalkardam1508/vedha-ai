"use client";

import { useEffect, useRef, useState } from "react";
import type { NovaVoiceState } from "@/hooks/useInterviewerVoice";

interface UseVoiceSyncedTextOptions {
  text: string;
  active: boolean;
  voiceState: NovaVoiceState;
  progressRef: React.RefObject<number>;
}

/** Reveals `text` in step with the real audio timeline (progressRef, 0..1) instead of a guessed typing speed. */
export function useVoiceSyncedText({ text, active, voiceState, progressRef }: UseVoiceSyncedTextOptions): string {
  const [revealed, setRevealed] = useState("");
  const lengthRef = useRef(0);
  const prevTextRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !text) {
      setRevealed("");
      lengthRef.current = 0;
      prevTextRef.current = null;
      return;
    }

    const isNewText = prevTextRef.current !== text;
    prevTextRef.current = text;

    if (voiceState === "error") {
      // TTS failed outright — no audio to sync to, so just show the full line so the
      // candidate can still read the question during the short fallback window.
      setRevealed(text);
      lengthRef.current = text.length;
      return;
    }

    if (voiceState !== "speaking") {
      if (isNewText) {
        // A fresh line that hasn't started playing yet (still fetching audio) — wait for
        // real playback rather than flashing the full text and resetting once it starts.
        setRevealed("");
        lengthRef.current = 0;
      }
      // Otherwise this is the same line that just finished speaking (state went back to
      // "idle" during the post-speech hold) — leave the fully-revealed text on screen.
      return;
    }

    setRevealed("");
    lengthRef.current = 0;
    let raf: number;
    const tick = () => {
      const progress = Math.min(1, progressRef.current ?? 0);
      const targetLength = Math.ceil(text.length * progress);
      if (targetLength !== lengthRef.current) {
        lengthRef.current = targetLength;
        setRevealed(text.slice(0, targetLength));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, active, voiceState, progressRef]);

  return revealed;
}

"use client";

import { useCallback, useRef, useState } from "react";

export type NovaVoiceState = "idle" | "speaking" | "error";

// Three named voice presets a candidate can pick before the interview starts (see
// LandingStep.tsx). Browsers don't ship literal voices called "Veda" or "Dhruv" — each preset
// is really a different matching preference over whatever voices the browser actually has,
// falling back gracefully when a system doesn't have anything closer. A few of the name hints
// below (Neerja, Heera, Dhruv, Ravi) are real installed voice names on Windows/Edge for
// Indian English/Hindi, so on those systems the match can be exact, not just a style guess.
export type VoicePreset = "veda" | "nova" | "dhruv";

const INDIAN_MALE_NAME_HINTS = /ravi|rishi|prabhat|hemant|dhruv|male/i;
const INDIAN_FEMALE_NAME_HINTS = /neerja|heera|kalpana|lekha|female/i;
const GENERIC_MALE_NAME_HINTS = /male|david|mark|daniel|george|guy/i;
const GENERIC_FEMALE_NAME_HINTS = /female|zira|susan|samantha|victoria|karen|aria|jenny/i;

function isIndianVoice(v: SpeechSynthesisVoice): boolean {
  const lang = v.lang.toLowerCase();
  return lang.startsWith("en-in") || lang.startsWith("hi-in");
}

// Exported so a one-off "hear this voice" demo (see HomePage.tsx) can reuse the exact same
// matching logic without needing the full speak()/progress-tracking machinery below.
export function pickVoice(preset: VoicePreset): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (voices.length === 0) return null;
  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const indianVoices = voices.filter(isIndianVoice);

  // Veda's own pick, worked out first — Nova and Dhruv are matched *against* this and actively
  // avoid landing on the exact same voice object. Name-hint heuristics alone weren't enough: on
  // a system with only one Indian voice installed (or one whose name matches neither the male
  // nor female hint list), every preset's independent heuristic could quietly converge on that
  // same single voice. This guarantees three different presets never sound identical unless the
  // system genuinely has only one voice installed, period.
  const vedaVoice: SpeechSynthesisVoice =
    indianVoices.find((v) => INDIAN_MALE_NAME_HINTS.test(v.name)) ??
    indianVoices[0] ??
    englishVoices.find((v) => GENERIC_MALE_NAME_HINTS.test(v.name)) ??
    englishVoices[0] ??
    voices[0];

  if (preset === "veda") return vedaVoice;

  if (preset === "nova") {
    return (
      indianVoices.find((v) => INDIAN_FEMALE_NAME_HINTS.test(v.name)) ??
      voices.find((v) => GENERIC_FEMALE_NAME_HINTS.test(v.name)) ??
      indianVoices.find((v) => v !== vedaVoice) ??
      englishVoices.find((v) => v !== vedaVoice) ??
      voices.find((v) => v !== vedaVoice) ??
      vedaVoice
    );
  }

  // "dhruv" — a plain male voice, deliberately preferring a non-Indian-accented one first so it
  // reads distinctly from Veda's Indian-accented default.
  return (
    englishVoices.find((v) => !isIndianVoice(v) && GENERIC_MALE_NAME_HINTS.test(v.name) && v !== vedaVoice) ??
    englishVoices.find((v) => GENERIC_MALE_NAME_HINTS.test(v.name) && v !== vedaVoice) ??
    englishVoices.find((v) => v !== vedaVoice) ??
    voices.find((v) => v !== vedaVoice) ??
    vedaVoice
  );
}

export function useInterviewerVoice(holdAfterSpeechMs = 3000, voicePreset: VoicePreset = "veda") {
  const [state, setState] = useState<NovaVoiceState>("idle");

  // Live 0..1 caption-reveal progress — driven by real onboundary word events where the
  // browser fires them, with a time-based estimate filling in the gaps so text never stalls.
  const progressRef = useRef(0);
  // Unused by the browser-speech mouth animation (CSS loop drives it instead), kept only so
  // InterviewerAvatar's prop shape doesn't need to change if levelRef is passed as undefined.
  const levelRef = useRef(0);

  const callIdRef = useRef(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    callIdRef.current++;
    clearTimers();
    progressRef.current = 0;
    window.speechSynthesis?.cancel();
    setState("idle");
  }, [clearTimers]);

  const speak = useCallback(
    (text: string, onEnded: () => void) => {
      stop();
      const callId = ++callIdRef.current;

      if (!window.speechSynthesis) {
        // No speech synthesis support at all — resilience fallback, same idea as before.
        setState("error");
        holdTimerRef.current = setTimeout(() => {
          if (callIdRef.current !== callId) return;
          setState("idle");
          onEnded();
        }, 800);
        return;
      }

      const doSpeak = () => {
        // A stop()/newer speak() may have superseded this call while it was waiting on voices
        // to finish loading below — never let a stale, already-cancelled call start talking.
        if (callIdRef.current !== callId) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 1;
        const voice = pickVoice(voicePreset);
        if (voice) utterance.voice = voice;

        progressRef.current = 0;
        const startedAt = performance.now();
        // ~15 chars/sec is a reasonable average speaking pace — used only to keep progress
        // moving forward between real onboundary events, never to override them.
        const estimatedDurationMs = Math.max(1200, (text.length / 15) * 1000);

        const tick = () => {
          if (callIdRef.current !== callId) return;
          const elapsed = performance.now() - startedAt;
          const timeBased = Math.min(1, elapsed / estimatedDurationMs);
          progressRef.current = Math.max(progressRef.current, timeBased);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

        utterance.onboundary = (event) => {
          if (callIdRef.current !== callId) return;
          if (typeof event.charIndex === "number" && text.length > 0) {
            progressRef.current = Math.max(progressRef.current, Math.min(1, event.charIndex / text.length));
          }
        };

        utterance.onend = () => {
          if (callIdRef.current !== callId) return;
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          progressRef.current = 1;
          setState("idle");
          // Hold on the completed sentence for a beat before moving on.
          holdTimerRef.current = setTimeout(() => {
            if (callIdRef.current !== callId) return;
            onEnded();
          }, holdAfterSpeechMs);
        };

        utterance.onerror = () => {
          if (callIdRef.current !== callId) return;
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          setState("error");
          holdTimerRef.current = setTimeout(() => {
            if (callIdRef.current !== callId) return;
            setState("idle");
            onEnded();
          }, 800);
        };

        setState("speaking");
        window.speechSynthesis.speak(utterance);
      };

      // Chrome loads its voice list asynchronously — on a fresh page load, the very first
      // speak() call can fire before it's populated, so pickVoice() silently falls back to
      // whatever the browser's own default voice happens to be for just that one utterance,
      // while every later call in the same session correctly gets Veda/Nova/Dhruv. That
      // mismatch is exactly why the voice can sound like it "changes" mid-session. Waiting
      // once for the list to be ready (with a timeout safety net, since some browsers never
      // fire this event at all) makes the very first line consistent with the rest.
      if (window.speechSynthesis.getVoices().length === 0) {
        let started = false;
        const startOnce = () => {
          if (started) return;
          started = true;
          doSpeak();
        };
        window.speechSynthesis.addEventListener("voiceschanged", startOnce, { once: true });
        setTimeout(startOnce, 1000);
      } else {
        doSpeak();
      }
    },
    [holdAfterSpeechMs, stop, voicePreset]
  );

  return { state, speak, stop, levelRef, progressRef };
}

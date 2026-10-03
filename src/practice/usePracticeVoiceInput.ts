"use client";

import { useCallback, useRef, useState } from "react";

// A lightweight, standalone speech-to-text hook for Practice mode — same continuous
// SpeechRecognition + auto-restart-on-drop pattern as useQuestionRecorder.ts (used by the real
// proctored interview), but without any of that hook's video/audio recording machinery, since
// Practice mode never records anything.
export function usePracticeVoiceInput() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isRecognizingRef = useRef(false);
  const versionRef = useRef(0); // invalidates stale onend restart timers after a deliberate stop
  const finalTextRef = useRef("");

  const start = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Your browser doesn't support voice input — try Chrome or Edge.");
      return;
    }
    setError(null);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }

    finalTextRef.current = "";
    setTranscript("");

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTextRef.current += t + " ";
        } else {
          interim = t;
        }
      }
      setTranscript((finalTextRef.current + interim).trim());
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-available") {
        isRecognizingRef.current = false;
        setIsListening(false);
        setError(
          event.error === "not-allowed"
            ? "Microphone access is blocked. Check your browser's site permissions and try again."
            : "Speech recognition service is unavailable right now."
        );
      }
      // non-fatal (no-speech, aborted, network) — onend fires next, restart handled there
    };

    const sessionVersion = ++versionRef.current;

    recognition.onend = () => {
      setIsListening(false);
      if (isRecognizingRef.current && versionRef.current === sessionVersion) {
        setTimeout(() => {
          if (isRecognizingRef.current && versionRef.current === sessionVersion) {
            recognition.start();
            setIsListening(true);
          }
        }, 50);
      }
    };

    recognitionRef.current = recognition;
    isRecognizingRef.current = true;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      /* a start() called too soon after a previous one — the onend/restart cycle recovers this */
    }
  }, []);

  const stop = useCallback(() => {
    versionRef.current++;
    isRecognizingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return { transcript, isListening, error, start, stop };
}

"use client";

import { useRef, useCallback, useState } from "react";

interface UseQuestionRecorderOptions {
  screenStream: MediaStream | null;
  webcamStream: MediaStream | null;
  micStream: MediaStream | null;
  systemAudioStream: MediaStream | null;
}

export interface QuestionRecordingResult {
  videoBlob: Blob;
  audioBlob: Blob;
  videoUrl: string;
  audioUrl: string;
  duration: number;
  startTime: string;
  endTime: string;
  transcript: string;
}

export function useQuestionRecorder({
  screenStream,
  webcamStream,
  micStream,
  systemAudioStream,
}: UseQuestionRecorderOptions) {
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<string>("");
  const startEpochRef = useRef<number>(0);

  // Speech recognition
  const recognitionRef = useRef<any>(null);
  const isRecognizingRef = useRef(false);
  const recognitionVersionRef = useRef(0); // incremented on every deliberate stop — invalidates stale onend timers
  const finalTextRef = useRef(""); // persists confirmed text across recognition restarts within a question
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const transcriptRef = useRef("");

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Kill any lingering instance before creating a new one
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

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
      const combined = finalTextRef.current + interim;
      transcriptRef.current = combined;
      setTranscript(combined);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-available") {
        // Fatal — mic denied or speech service down, no point restarting
        isRecognizingRef.current = false;
        setIsListening(false);
      }
      // non-fatal (no-speech, aborted, network) → onend fires next → restart handled there
    };

    // Pin version at creation time — stale onend timers from previous sessions carry an old version and are ignored
    const sessionVersion = ++recognitionVersionRef.current;

    recognition.onend = () => {
      setIsListening(false);
      if (isRecognizingRef.current && recognitionVersionRef.current === sessionVersion) {
        setTimeout(() => {
          if (isRecognizingRef.current && recognitionVersionRef.current === sessionVersion) {
            startSpeechRecognition();
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
      setTimeout(() => {
        if (isRecognizingRef.current && recognitionVersionRef.current === sessionVersion) {
          startSpeechRecognition();
        }
      }, 300);
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    recognitionVersionRef.current++; // invalidate all pending onend timers before stopping
    isRecognizingRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!screenStream || !webcamStream || !micStream) return;

    // Ensure any previous recognition is fully stopped before starting fresh
    stopSpeechRecognition();

    // Reset transcript for this question
    finalTextRef.current = "";
    transcriptRef.current = "";
    setTranscript("");
    startTimeRef.current = new Date().toISOString();
    startEpochRef.current = Date.now();

    // --- Canvas composite: screen (main) + webcam PIP ---
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d")!;

    const screenVid = document.createElement("video");
    screenVid.srcObject = screenStream;
    screenVid.muted = true;
    screenVid.play().catch(() => {});

    const camVid = document.createElement("video");
    camVid.srcObject = webcamStream;
    camVid.muted = true;
    camVid.play().catch(() => {});

    const draw = () => {
      // Draw screen
      if (screenVid.readyState >= 2) {
        ctx.drawImage(screenVid, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = "#0a0a0f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      // Webcam PIP — bottom right corner
      if (camVid.readyState >= 2) {
        const pw = 280, ph = 210, margin = 20;
        const px = canvas.width - pw - margin;
        const py = canvas.height - ph - margin;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 10);
        ctx.clip();
        ctx.drawImage(camVid, px, py, pw, ph);
        ctx.restore();
        // PIP border
        ctx.strokeStyle = "rgba(99,102,241,0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 10);
        ctx.stroke();
      }
      // REC indicator
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(24, 24, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px monospace";
      ctx.fillText("REC", 38, 29);

      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();

    // --- Audio context: merge mic + system audio ---
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();

    const micSource = audioCtx.createMediaStreamSource(micStream);
    micSource.connect(dest);

    if (systemAudioStream && systemAudioStream.getAudioTracks().length > 0) {
      const sysSource = audioCtx.createMediaStreamSource(
        new MediaStream(systemAudioStream.getAudioTracks())
      );
      sysSource.connect(dest);
    } else if (screenStream.getAudioTracks().length > 0) {
      const sysSource = audioCtx.createMediaStreamSource(
        new MediaStream(screenStream.getAudioTracks())
      );
      sysSource.connect(dest);
    }

    // --- Final video stream: canvas video + merged audio ---
    const canvasStream = canvas.captureStream(30);
    const videoStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);

    // --- Audio-only stream ---
    const audioStream = new MediaStream([...dest.stream.getAudioTracks()]);

    // Video recorder
    const videoMime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const videoChunks: Blob[] = [];
    const videoRec = new MediaRecorder(videoStream, { mimeType: videoMime });
    videoRec.ondataavailable = (e) => { if (e.data.size > 0) videoChunks.push(e.data); };
    videoRec.onstop = () => {
      (videoRec as any)._chunks = videoChunks;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      audioCtx.close().catch(() => {});
    };
    videoRec.start(1000);
    videoRecorderRef.current = videoRec;

    // Audio recorder
    const audioChunks: Blob[] = [];
    const audioRec = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
    audioRec.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    audioRec.onstop = () => { (audioRec as any)._chunks = audioChunks; };
    audioRec.start(1000);
    audioRecorderRef.current = audioRec;

    // Start speech recognition
    startSpeechRecognition();
  }, [screenStream, webcamStream, micStream, systemAudioStream, startSpeechRecognition, stopSpeechRecognition]);

  const stopRecording = useCallback((): Promise<QuestionRecordingResult> => {
    return new Promise((resolve) => {
      // Increment version first — invalidates any pending onend timers from the current session
      recognitionVersionRef.current++;
      isRecognizingRef.current = false;
      setIsListening(false);

      // Hold the recognition reference — do NOT clear it yet.
      // Chrome fires remaining onresult events (last words) before onend.
      // We wait for onend to fire before capturing the transcript.
      const recognition = recognitionRef.current;
      recognitionRef.current = null;

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      const endTime = new Date().toISOString();
      const duration = Math.round((Date.now() - startEpochRef.current) / 1000);

      const videoRec = videoRecorderRef.current;
      const audioRec = audioRecorderRef.current;

      if (!videoRec || !audioRec) {
        if (recognition) try { recognition.stop(); } catch {}
        resolve({
          videoBlob: new Blob(),
          audioBlob: new Blob(),
          videoUrl: "",
          audioUrl: "",
          duration: 0,
          startTime: startTimeRef.current,
          endTime,
          transcript: transcriptRef.current,
        });
        return;
      }

      let videoDone = false;
      let audioDone = false;
      let speechDone = !recognition; // already done if no recognition was running

      const tryResolve = () => {
        if (!videoDone || !audioDone || !speechDone) return;
        const videoChunks: Blob[] = (videoRec as any)._chunks || [];
        const audioChunks: Blob[] = (audioRec as any)._chunks || [];
        const videoBlob = new Blob(videoChunks, { type: "video/webm" });
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        resolve({
          videoBlob,
          audioBlob,
          videoUrl: URL.createObjectURL(videoBlob),
          audioUrl: URL.createObjectURL(audioBlob),
          duration,
          startTime: startTimeRef.current,
          endTime,
          transcript: transcriptRef.current, // captured after all onresult events fired
        });
      };

      if (recognition) {
        recognition.addEventListener("end", () => { speechDone = true; tryResolve(); }, { once: true });
        // Safety: if onend never fires (browser bug), unblock after 1.5s
        setTimeout(() => { speechDone = true; tryResolve(); }, 1500);
        try { recognition.stop(); } catch { speechDone = true; tryResolve(); }
      }

      videoRec.addEventListener("stop", () => { videoDone = true; tryResolve(); }, { once: true });
      audioRec.addEventListener("stop", () => { audioDone = true; tryResolve(); }, { once: true });

      if (videoRec.state !== "inactive") videoRec.stop();
      else { videoDone = true; tryResolve(); }

      if (audioRec.state !== "inactive") audioRec.stop();
      else { audioDone = true; tryResolve(); }
    });
  }, []);

  return {
    startRecording,
    stopRecording,
    transcript,
    isListening,
  };
}

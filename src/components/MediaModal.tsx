"use client";

import { useEffect, useRef } from "react";
import type { QuestionRecording } from "@/types";
import { formatTime } from "@/lib/utils";
import { downloadBlob } from "@/lib/utils";

interface MediaModalProps {
  recording: QuestionRecording | null;
  type: "video" | "audio" | null;
  onClose: () => void;
}

export function MediaModal({ recording, type, onClose }: MediaModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!recording || !type) return null;

  const url = type === "video" ? recording.videoUrl : recording.audioUrl;
  const blob = type === "video" ? recording.videoBlob : recording.audioBlob;
  const filename = `Q${recording.questionIndex + 1}-${type}.webm`;

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">
            <i className={`ti ${type === "video" ? "ti-video" : "ti-volume"}`} />
            Q{recording.questionIndex + 1} — {type === "video" ? "Video Recording" : "Audio Recording"}
          </div>
          <div className="modal-meta">
            <span>{formatTime(recording.duration)}</span>
            <span>{new Date(recording.startTime).toLocaleTimeString()}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="modal-body">
          {type === "video" ? (
            <video
              src={url}
              controls
              autoPlay
              className="modal-video"
              style={{ width: "100%", borderRadius: "8px", background: "#000", maxHeight: "420px" }}
            />
          ) : (
            <div className="audio-player-wrapper">
              <div className="audio-art">
                <i className="ti ti-waveform" style={{ fontSize: "48px", color: "rgba(99,102,241,0.4)" }} />
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "12px" }}>
                  Question {recording.questionIndex + 1} Audio
                </div>
              </div>
              <audio
                src={url}
                controls
                autoPlay
                style={{ width: "100%", marginTop: "16px" }}
              />
            </div>
          )}

          {/* Transcript */}
          <div className="modal-transcript">
            <div className="transcript-label">
              <i className="ti ti-message-circle" /> Transcript
            </div>
            <p className="transcript-text">
              {recording.transcript || <em style={{ color: "var(--text-dim)" }}>No transcript recorded.</em>}
            </p>
          </div>

          {/* Timing */}
          <div className="modal-timing">
            <div className="timing-item">
              <span className="timing-label">Started</span>
              <span className="timing-val">{new Date(recording.startTime).toLocaleTimeString()}</span>
            </div>
            <div className="timing-item">
              <span className="timing-label">Ended</span>
              <span className="timing-val">{new Date(recording.endTime).toLocaleTimeString()}</span>
            </div>
            <div className="timing-item">
              <span className="timing-label">Duration</span>
              <span className="timing-val">{formatTime(recording.duration)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn-outline"
            onClick={() => downloadBlob(blob, filename)}
          >
            <i className="ti ti-download" /> Download {type}
          </button>
          <button className="btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

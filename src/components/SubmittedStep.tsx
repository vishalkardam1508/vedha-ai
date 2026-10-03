"use client";

import { useState } from "react";
import type { InterviewJSON, QuestionRecording, Warning } from "@/types";
import { formatTime, downloadJSON, downloadBlob } from "@/lib/utils";
import { summarizeQuestionBehavior } from "@/lib/behaviorSummary";
import { generatePdfReport } from "@/lib/generatePdfReport";
import { MediaModal } from "./MediaModal";

interface SubmittedStepProps {
  data: InterviewJSON;
  onRestart: () => void;
}

function WarnLogList({ warnings, onViewSnapshot }: { warnings: Warning[]; onViewSnapshot: (src: string) => void }) {
  return (
    <>
      {warnings.map((w, i) => (
        <div key={i} className="warn-log-item">
          <span className="warn-time">{w.timestamp}</span>
          <span className="warn-type">{w.type.replace(/_/g, " ")}</span>
          <span className="warn-msg">{w.message}</span>
          {w.snapshot && (
            <img
              src={w.snapshot}
              alt="Camera snapshot at the moment of this violation"
              className="warn-snapshot-thumb"
              onClick={() => onViewSnapshot(w.snapshot!)}
            />
          )}
        </div>
      ))}
    </>
  );
}

export function SubmittedStep({ data, onRestart }: SubmittedStepProps) {
  const [showJSON, setShowJSON] = useState(false);
  const [modalRec, setModalRec] = useState<QuestionRecording | null>(null);
  const [modalType, setModalType] = useState<"video" | "audio" | null>(null);
  const [modalSnapshot, setModalSnapshot] = useState<string | null>(null);
  // A reviewer looking at the finished report can manually flag it Disqualified for something
  // the automatic 3-strike system missed — local to this view/export, no backend to persist it.
  const [manualOverrideStatus, setManualOverrideStatus] = useState<InterviewJSON["status"] | null>(null);
  const status = manualOverrideStatus ?? data.status;

  function markDisqualified() {
    if (!window.confirm("Mark this interview as Disqualified? This only affects this report and its downloads.")) return;
    setManualOverrideStatus("disqualified");
  }

  function undoOverride() {
    setManualOverrideStatus(null);
  }

  function openModal(rec: QuestionRecording, type: "video" | "audio") {
    setModalRec(rec);
    setModalType(type);
  }

  function closeModal() {
    setModalRec(null);
    setModalType(null);
  }

  const jsonForDownload = {
    ...data,
    status,
    questions: data.questions.map((q) => ({
      questionIndex: q.questionIndex,
      question: q.question,
      transcript: q.transcript,
      startTime: q.startTime,
      endTime: q.endTime,
      duration: q.duration,
      videoUrl: q.videoUrl,
      audioUrl: q.audioUrl,
    })),
  };

  return (
    <>
      <MediaModal recording={modalRec} type={modalType} onClose={closeModal} />

      {modalSnapshot && (
        <div className="modal-overlay" onClick={() => setModalSnapshot(null)}>
          <img src={modalSnapshot} alt="Camera snapshot at the moment of the violation" className="warn-snapshot-full" />
        </div>
      )}

      <div className="card submitted-card">
        {/* Header */}
        {status === "disqualified" ? (
          <div className="success-header">
            <div className="success-icon" style={{ background: "rgba(239,68,68,0.15)", color: "var(--red)" }}>
              <i className="ti ti-ban" />
            </div>
            <h1 className="heading" style={{ fontSize: "1.5rem", textAlign: "center", color: "var(--red)" }}>
              Interview Disqualified
            </h1>
            <p className="sub" style={{ textAlign: "center", marginBottom: manualOverrideStatus ? "0.75rem" : 0 }}>
              {manualOverrideStatus === "disqualified"
                ? `Manually marked as disqualified after review — all ${data.questions.length} question${data.questions.length !== 1 ? "s" : ""} were completed.`
                : `Ended early due to repeated proctoring violations — ${data.questions.length} question${data.questions.length !== 1 ? "s" : ""} recorded before submission.`}
            </p>
            {manualOverrideStatus === "disqualified" && (
              <button className="btn-outline" onClick={undoOverride}>
                <i className="ti ti-arrow-back-up" /> Undo — Restore Original Status
              </button>
            )}
          </div>
        ) : status === "rejected" ? (
          <div className="success-header">
            <div className="success-icon" style={{ background: "rgba(239,68,68,0.15)", color: "var(--red)" }}>
              <i className="ti ti-circle-x" />
            </div>
            <h1 className="heading" style={{ fontSize: "1.5rem", textAlign: "center", color: "var(--red)" }}>
              Interview Rejected
            </h1>
            <p className="sub" style={{ textAlign: "center", marginBottom: "1rem" }}>
              Completed all {data.questions.length} question{data.questions.length !== 1 ? "s" : ""}, but flagged for{" "}
              {data.warningCount} proctoring warning{data.warningCount !== 1 ? "s" : ""} during the interview.
            </p>
            <div className="warn-log" style={{ textAlign: "left" }}>
              <div className="warn-log-title">
                <i className="ti ti-alert-triangle" /> All flagged violations
              </div>
              <WarnLogList warnings={data.warnings} onViewSnapshot={setModalSnapshot} />
            </div>
          </div>
        ) : (
          <div className="success-header">
            <div className="success-icon">
              <i className="ti ti-check" />
            </div>
            <h1 className="heading" style={{ fontSize: "1.5rem", textAlign: "center" }}>
              Interview Complete
            </h1>
            <p className="sub" style={{ textAlign: "center", marginBottom: 0 }}>
              All {data.questions.length} questions recorded successfully.
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="stats-grid">
          {[
            ["ti-clock", "Total Duration", formatTime(data.duration)],
            ["ti-video", "Recordings", `${data.questions.length}`],
            ["ti-alert-triangle", "Warnings", `${data.warningCount}`],
            ["ti-repeat", "Tab Changes", `${data.tabChange}`],
          ].map(([ic, lb, val]) => (
            <div key={lb} className="stat-card">
              <i className={`ti ${ic}`} />
              <div className="stat-label">{lb}</div>
              <div className="stat-val">{val}</div>
            </div>
          ))}
        </div>

        {/* Timing row */}
        <div className="timing-overview">
          <div className="timing-item">
            <span className="timing-label">Started</span>
            <span className="timing-val">{new Date(data.startTime).toLocaleTimeString()}</span>
          </div>
          <div className="timing-sep" />
          <div className="timing-item">
            <span className="timing-label">Ended</span>
            <span className="timing-val">{new Date(data.endTime).toLocaleTimeString()}</span>
          </div>
          <div className="timing-sep" />
          <div className="timing-item">
            <span className="timing-label">Duration</span>
            <span className="timing-val">{formatTime(data.duration)}</span>
          </div>
          <div className="timing-sep" />
          <div className="timing-item">
            <span className="timing-label">ID</span>
            <span className="timing-val" style={{ fontSize: "10px" }}>{data.interviewId}</span>
          </div>
        </div>

        <div className="divider" />

        {/* Per-question recordings */}
        <div className="section-title">
          <i className="ti ti-player-record" /> Per-Question Recordings
        </div>

        <div className="recordings-list">
          {data.questions.map((rec) => {
            const entriesForThisQuestion = data.bodyLog.filter((e) => e.questionIndex === rec.questionIndex);
            const behaviorSummary = summarizeQuestionBehavior(entriesForThisQuestion);
            return (
              <div key={rec.questionIndex} className="rec-card">
                <div className="rec-card-header">
                  <div className="rec-q-num">Q{rec.questionIndex + 1}</div>
                  <div className="rec-q-text">{rec.question}</div>
                  <div className="rec-duration">{formatTime(rec.duration)}</div>
                </div>

                {/* Transcript */}
                <div className="rec-transcript">
                  {rec.transcript
                    ? rec.transcript
                    : <em style={{ color: "var(--text-dim)" }}>No transcript recorded</em>}
                </div>

                {/* Timing */}
                <div className="rec-timing">
                  <span>
                    <i className="ti ti-clock" />
                    {new Date(rec.startTime).toLocaleTimeString()} → {new Date(rec.endTime).toLocaleTimeString()}
                  </span>
                </div>

                {/* Behavior log for this question — informational only, never a violation.
                    Nested here (not a separate global section) so it's obvious which video it belongs
                    to, and "Watch Video" right below plays exactly that clip. */}
                {entriesForThisQuestion.length > 0 && (
                  <div className="behavior-log" style={{ marginBottom: 12 }}>
                    <div className="behavior-log-title">
                      <i className="ti ti-activity" /> Behavior log for this answer
                      <span
                        className="behavior-summary-badge"
                        title="Experimental heuristic derived from posture, gaze, and expression signals — not a validated measure of confidence or stress."
                      >
                        {behaviorSummary.label}
                      </span>
                    </div>
                    {entriesForThisQuestion.map((entry, i) => (
                      <div key={i} className="behavior-log-item">
                        <span className="behavior-log-time">{entry.timestamp}</span>
                        <span className="behavior-log-expr">{entry.expression}</span>
                        <span className="behavior-log-bodies">
                          {entry.bodyCount} {entry.bodyCount === 1 ? "body" : "bodies"}
                        </span>
                        {entry.postureShift && <span className="behavior-log-posture">posture shift</span>}
                        {entry.lookingAway && <span className="behavior-log-lookaway">looking away</span>}
                        {entry.possibleSunglasses && (
                          <span className="behavior-log-sunglasses" title="Best-effort heuristic — may be inaccurate.">
                            possible sunglasses
                          </span>
                        )}
                        {entry.possibleStaticImage && (
                          <span className="behavior-log-sunglasses" title="No natural facial micro-movement detected for a while — could indicate a static photo held to the camera. Weak heuristic, may be inaccurate.">
                            possible static image
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="rec-actions">
                  <button className="rec-btn video-btn" onClick={() => openModal(rec, "video")}>
                    <i className="ti ti-player-play" /> Watch Video
                  </button>
                  <button className="rec-btn audio-btn" onClick={() => openModal(rec, "audio")}>
                    <i className="ti ti-volume" /> Listen Audio
                  </button>
                  <button className="rec-btn dl-btn" onClick={() => downloadBlob(rec.videoBlob, `Q${rec.questionIndex + 1}-video.webm`)}>
                    <i className="ti ti-download" /> Video
                  </button>
                  <button className="rec-btn dl-btn" onClick={() => downloadBlob(rec.audioBlob, `Q${rec.questionIndex + 1}-audio.webm`)}>
                    <i className="ti ti-download" /> Audio
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="divider" />

        {/* Warning log */}
        {/* Skip for "rejected" — that full list is already shown in the header above. */}
        {data.warnings.length > 0 && status !== "rejected" && (
          <>
            <div className="section-title">
              <i className="ti ti-alert-triangle" /> Proctoring Warnings
            </div>
            <div className="warn-log" style={{ marginBottom: "1.5rem" }}>
              <WarnLogList warnings={data.warnings} onViewSnapshot={setModalSnapshot} />
            </div>
          </>
        )}

        {/* Actions */}
        <div className="btn-group">
          <button className="btn-outline" onClick={() => generatePdfReport(data, manualOverrideStatus ?? undefined)}>
            <i className="ti ti-file-type-pdf" /> Download PDF Report
          </button>
          <button className="btn-outline" onClick={() => downloadJSON(jsonForDownload, `interview-${data.interviewId}.json`)}>
            <i className="ti ti-download" /> Download JSON
          </button>
          <button className="btn-outline" onClick={() => setShowJSON((s) => !s)}>
            <i className="ti ti-code" /> {showJSON ? "Hide" : "View"} JSON
          </button>
          {status !== "disqualified" && (
            <button
              className="btn-outline"
              style={{ color: "var(--red)", borderColor: "rgba(220,38,38,0.35)" }}
              onClick={markDisqualified}
            >
              <i className="ti ti-ban" /> Mark as Disqualified
            </button>
          )}
          <button className="btn-outline" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }} onClick={onRestart}>
            <i className="ti ti-refresh" /> Restart
          </button>
        </div>

        {showJSON && (
          <div className="json-section" style={{ marginTop: "1.25rem" }}>
            <pre className="json-box">{JSON.stringify(jsonForDownload, null, 2)}</pre>
          </div>
        )}
      </div>
    </>
  );
}

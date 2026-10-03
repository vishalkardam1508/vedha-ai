"use client";

import type { PracticeReportData, PracticeScorecardEntry } from "./types";

interface PracticeReportProps {
  report: PracticeReportData;
  scorecard?: PracticeScorecardEntry[];
  onRestart: () => void;
}

export function PracticeReport({ report, scorecard = [], onRestart }: PracticeReportProps) {
  const averageScore =
    scorecard.length > 0 ? Math.round((scorecard.reduce((sum, e) => sum + e.score, 0) / scorecard.length) * 10) / 10 : null;

  return (
    <div className="card practice-card">
      <div className="success-header">
        <div className="success-icon">
          <i className="ti ti-report" />
        </div>
        <h1 className="heading" style={{ fontSize: "1.5rem", textAlign: "center" }}>
          Practice Report
        </h1>
        <p className="sub" style={{ textAlign: "center", marginBottom: 0 }}>
          {report.summary}
        </p>
      </div>

      {report.resumeMatch && (
        <>
          <div className="divider" />
          <div className="section-title">
            <i className="ti ti-file-check" /> Resume Match
          </div>
          <div className="practice-resume-match">
            <div className="practice-resume-match-score">
              <div className="practice-resume-match-score-num">{report.resumeMatch.score}%</div>
              <div className="practice-resume-match-bar">
                <div className="practice-resume-match-bar-fill" style={{ width: `${Math.max(0, Math.min(100, report.resumeMatch.score))}%` }} />
              </div>
            </div>
            <p className="sub" style={{ marginBottom: "0.75rem" }}>{report.resumeMatch.notes}</p>
            {report.resumeMatch.matchedSkills.length > 0 && (
              <div className="practice-resume-skill-row">
                <span className="practice-resume-skill-label">Matched</span>
                {report.resumeMatch.matchedSkills.map((s, i) => (
                  <span key={i} className="practice-resume-skill-chip practice-resume-skill-chip--match">{s}</span>
                ))}
              </div>
            )}
            {report.resumeMatch.missingSkills.length > 0 && (
              <div className="practice-resume-skill-row">
                <span className="practice-resume-skill-label">Missing</span>
                {report.resumeMatch.missingSkills.map((s, i) => (
                  <span key={i} className="practice-resume-skill-chip practice-resume-skill-chip--missing">{s}</span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {scorecard.length > 0 && (
        <>
          <div className="divider" />
          <div className="section-title">
            <i className="ti ti-star" /> Score Card
          </div>
          {averageScore !== null && (
            <div className="practice-scorecard-average">Average: {averageScore} / 10</div>
          )}
          <div className="practice-scorecard-list">
            {scorecard.map((entry, i) => (
              <div key={i} className="practice-scorecard-item">
                <span className="practice-score-badge">
                  <i className="ti ti-star-filled" /> {entry.score}/10
                </span>
                <div className="practice-scorecard-question">{entry.question}</div>
                <div className="practice-scorecard-answer">{entry.answer}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {report.corrections.length > 0 && (
        <>
          <div className="divider" />
          <div className="section-title">
            <i className="ti ti-edit" /> Corrections
          </div>
          <div className="practice-correction-list">
            {report.corrections.map((c, i) => (
              <div key={i} className="practice-correction-item">
                <div className="practice-correction-mistake">
                  <i className="ti ti-x" /> {c.mistake}
                </div>
                <div className="practice-correction-fix">
                  <i className="ti ti-check" /> {c.correction}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {report.improvements.length > 0 && (
        <>
          <div className="divider" />
          <div className="section-title">
            <i className="ti ti-trending-up" /> Improvements
          </div>
          <ul className="practice-improvement-list">
            {report.improvements.map((imp, i) => (
              <li key={i}>{imp}</li>
            ))}
          </ul>
        </>
      )}

      <button
        className="btn-primary"
        style={{ marginTop: "1.5rem", width: "100%", justifyContent: "center" }}
        onClick={onRestart}
      >
        <i className="ti ti-refresh" /> Practice Again
      </button>
    </div>
  );
}

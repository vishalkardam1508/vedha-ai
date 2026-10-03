"use client";

import { useEffect, useState } from "react";
import type { JdDetails, PracticeMode, TechnicalTopic } from "./types";

const TOPICS: TechnicalTopic[] = ["React", "Node.js", "JavaScript", "Angular", "AI Engineer"];

interface PracticeSetupProps {
  error: string | null;
  onStart: (mode: PracticeMode, topics: TechnicalTopic[], jd?: JdDetails) => void;
}

type SetupStep = "modes" | "jd-details";

export function PracticeSetup({ error, onStart }: PracticeSetupProps) {
  const [step, setStep] = useState<SetupStep>("modes");
  const [mode, setMode] = useState<PracticeMode | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<TechnicalTopic[]>([]);
  const [company, setCompany] = useState("");
  const [experience, setExperience] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [checkingFit, setCheckingFit] = useState(false);
  const [mismatch, setMismatch] = useState<{ reason: string; score: number } | null>(null);

  // Chrome loads its speech-synthesis voice list asynchronously, and the very first speak()
  // call of a session (the first practice question) would otherwise have to wait for it —
  // showing a blank caption for a moment while Veda is already talking, which reads as the
  // question text and the speech not lining up. Poking getVoices() here, as early as this
  // screen mounts, gives the browser a head start so the list is usually ready well before
  // the candidate finishes picking a mode and clicks Start.
  useEffect(() => {
    window.speechSynthesis?.getVoices();
  }, []);

  function toggleTopic(topic: TechnicalTopic) {
    setSelectedTopics((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]));
  }

  function selectMode(selected: PracticeMode) {
    setMode(selected);
    if (selected === "jd") setStep("jd-details");
  }

  const canStartModes = mode === "english" || (mode === "technical" && selectedTopics.length > 0);
  const canStartJd =
    company.trim().length > 0 && experience.trim().length > 0 && jobDescription.trim().length > 0 && !resumeUploading;

  function handleStartModes() {
    if (!mode) return;
    onStart(mode, mode === "technical" ? selectedTopics : []);
  }

  async function handleStartJd() {
    const jd: JdDetails = {
      company: company.trim(),
      experience: experience.trim(),
      jobDescription: jobDescription.trim(),
      resumeText: resumeText.trim() || undefined,
    };

    // Only worth checking when there's actually a resume to compare — the JD alone has
    // nothing to judge fit against.
    if (jd.resumeText) {
      setMismatch(null);
      setCheckingFit(true);
      try {
        const res = await fetch("/api/practice/eligibility", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jd }),
        });
        const data = await res.json();
        if (res.ok && data.result && data.result.eligible === false) {
          setMismatch({ reason: data.result.reason, score: data.result.score });
          setCheckingFit(false);
          return;
        }
      } catch {
        // Fail open — a check failure shouldn't block practice.
      }
      setCheckingFit(false);
    }

    onStart("jd", [], jd);
  }

  async function handleResumeFile(file: File | undefined) {
    if (!file) return;
    setResumeError(null);
    setMismatch(null);
    setResumeUploading(true);
    setResumeText("");
    setResumeFileName("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/practice/resume", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Couldn't read that resume file.");
      setResumeText(data.text);
      setResumeFileName(file.name);
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : "Couldn't read that resume file.");
    } finally {
      setResumeUploading(false);
    }
  }

  if (step === "jd-details") {
    return (
      <div className="card practice-card">
        <button type="button" className="back-link" onClick={() => setStep("modes")}>
          <i className="ti ti-arrow-left" /> Back to modes
        </button>
        <div className="badge">
          <span className="dot" /> Interview Practice
        </div>
        <h1 className="heading">Tell Veda About the Role</h1>
        <p className="sub">Paste the job description — Veda will interview you for it and score every answer.</p>

        <div className="practice-jd-form">
          <div className="form-group">
            <label className="form-label" htmlFor="jd-company">Company</label>
            <input
              id="jd-company"
              className="form-input"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Acme Corp"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="jd-experience">Your experience</label>
            <input
              id="jd-experience"
              className="form-input"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="e.g. 3 years"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="jd-text">Job description</label>
            <textarea
              id="jd-text"
              className="form-input"
              rows={6}
              value={jobDescription}
              onChange={(e) => {
                setJobDescription(e.target.value);
                setMismatch(null);
              }}
              placeholder="Paste the full job description here…"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="jd-resume">Resume (optional)</label>
            <label className={`practice-resume-upload${resumeFileName ? " practice-resume-upload--done" : ""}`} htmlFor="jd-resume">
              <i className={`ti ${resumeUploading ? "ti-loader-2 spin" : resumeFileName ? "ti-file-check" : "ti-upload"}`} />
              {resumeUploading ? "Reading resume…" : resumeFileName || "Upload PDF or DOCX — Veda will score how well it fits this role"}
            </label>
            <input
              id="jd-resume"
              type="file"
              accept=".pdf,.docx"
              style={{ display: "none" }}
              onChange={(e) => handleResumeFile(e.target.files?.[0])}
            />
            {resumeError && (
              <div className="error-box" style={{ marginTop: "0.5rem" }}>
                <i className="ti ti-alert-triangle" /> {resumeError}
              </div>
            )}
          </div>
        </div>

        {mismatch && (
          <div className="practice-mismatch-box">
            <div className="practice-mismatch-title">
              <i className="ti ti-mood-sad" /> Not a strong fit for this role ({mismatch.score}% match)
            </div>
            <p>{mismatch.reason || "Your resume doesn't show the skills or experience this job description asks for."}</p>
            <button type="button" className="btn-outline" onClick={() => onStart("jd", [], {
              company: company.trim(),
              experience: experience.trim(),
              jobDescription: jobDescription.trim(),
              resumeText: resumeText.trim() || undefined,
            })}>
              Practice anyway →
            </button>
          </div>
        )}

        {error && (
          <div className="error-box" style={{ marginTop: "1rem" }}>
            <i className="ti ti-alert-triangle" /> {error}
          </div>
        )}

        <button
          className="btn-primary"
          style={{ marginTop: "1.5rem", width: "100%", justifyContent: "center" }}
          disabled={!canStartJd || checkingFit}
          onClick={handleStartJd}
        >
          {checkingFit ? (
            <>
              <i className="ti ti-loader-2 spin" /> Checking fit…
            </>
          ) : (
            "Start Practice →"
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="card practice-card">
      <div className="badge">
        <span className="dot" /> Practice & Learning
      </div>
      <h1 className="heading">Choose a Practice Mode</h1>
      <p className="sub">A quick, informal chat with Veda — not recorded, not proctored, just practice.</p>

      <div className="practice-mode-grid">
        <button
          type="button"
          className={`practice-mode-card${mode === "english" ? " practice-mode-card--active" : ""}`}
          onClick={() => selectMode("english")}
        >
          <i className="ti ti-message-circle" />
          <div className="practice-mode-title">English Conversation</div>
          <div className="practice-mode-desc">Casual back-and-forth chat to build fluency and confidence speaking English.</div>
        </button>
        <button
          type="button"
          className={`practice-mode-card${mode === "technical" ? " practice-mode-card--active" : ""}`}
          onClick={() => selectMode("technical")}
        >
          <i className="ti ti-code" />
          <div className="practice-mode-title">Technical Interview</div>
          <div className="practice-mode-desc">A mock technical interview on the stack of your choice.</div>
        </button>
        <button
          type="button"
          className="practice-mode-card"
          onClick={() => selectMode("jd")}
        >
          <i className="ti ti-file-text" />
          <div className="practice-mode-title">Interview Practice</div>
          <div className="practice-mode-desc">Paste a job description and get interviewed — and scored per answer — for that exact role.</div>
        </button>
      </div>

      {mode === "technical" && (
        <div className="practice-topics">
          <div className="practice-topics-label">Select one or more topics</div>
          <div className="practice-topic-grid">
            {TOPICS.map((topic) => {
              const active = selectedTopics.includes(topic);
              return (
                <button
                  key={topic}
                  type="button"
                  className={`practice-topic-chip${active ? " practice-topic-chip--active" : ""}`}
                  onClick={() => toggleTopic(topic)}
                >
                  {active && <i className="ti ti-check" />}
                  {topic}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="error-box" style={{ marginTop: "1rem" }}>
          <i className="ti ti-alert-triangle" /> {error}
        </div>
      )}

      <button
        className="btn-primary"
        style={{ marginTop: "1.5rem", width: "100%", justifyContent: "center" }}
        disabled={!canStartModes}
        onClick={handleStartModes}
      >
        Start Practice →
      </button>
    </div>
  );
}

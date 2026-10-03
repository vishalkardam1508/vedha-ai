export type PracticeMode = "english" | "technical" | "jd";

export type TechnicalTopic = "React" | "Node.js" | "JavaScript" | "Angular" | "AI Engineer";

export interface JdDetails {
  company: string;
  jobDescription: string;
  experience: string;
  // Plain text extracted server-side from an uploaded PDF/DOCX resume (see
  // /api/practice/resume) — optional, since matching still works from the JD alone.
  resumeText?: string;
}

export interface PracticeMessage {
  role: "user" | "assistant";
  content: string;
  // "jd" mode only — Veda's rating (1-10) of the candidate's previous answer, parsed out of a
  // leading [[SCORE:n]] tag in the raw model reply before it's spoken/displayed (see
  // parseScoreTag in usePracticeSession.ts). Present on assistant messages other than the
  // opening "introduce yourself" one.
  score?: number;
}

export interface PracticeCorrection {
  mistake: string;
  correction: string;
}

export interface PracticeResumeMatch {
  score: number; // 0-100 fit between resume and job description
  matchedSkills: string[];
  missingSkills: string[];
  notes: string;
}

export interface PracticeReportData {
  summary: string;
  corrections: PracticeCorrection[];
  improvements: string[];
  // "jd" mode only, and only when a resume was uploaded.
  resumeMatch?: PracticeResumeMatch;
}

export interface PracticeScorecardEntry {
  question: string;
  answer: string;
  score: number;
}

export type PracticeScreen = "setup" | "chatting" | "loading-report" | "report";

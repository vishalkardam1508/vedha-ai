"use client";

import Link from "next/link";
import { usePracticeSession } from "@/practice/usePracticeSession";
import { PracticeSetup } from "@/practice/PracticeSetup";
import { PracticeChat } from "@/practice/PracticeChat";
import { PracticeReport } from "@/practice/PracticeReport";
import { useTheme } from "@/hooks/useTheme";

export default function PracticePage() {
  const session = usePracticeSession();
  // Shared with the home page via localStorage — toggling here (or there) applies everywhere.
  const { dark, toggleTheme } = useTheme();

  return (
    <div className="practice-page" data-theme={dark ? "dark" : "light"}>
      <header className="practice-header">
        <Link href="/" className="practice-header-brand">
          <i className="ti ti-arrow-left" /> Veda AI Interview Platform
        </Link>
        <div className="practice-header-actions">
          <button
            type="button"
            className="home-theme-toggle"
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
            title={dark ? "Switch to light theme" : "Switch to dark theme"}
          >
            <i className={`ti ${dark ? "ti-sun" : "ti-moon"}`} />
          </button>
          <span className="practice-header-tag">Practice Mode</span>
        </div>
      </header>

      <div className="practice-page-body">
        {session.screen === "chatting" ? (
          <PracticeChat
            messages={session.messages}
            sending={session.sending}
            error={session.error}
            questionCount={session.questionCount}
            maxQuestions={session.maxQuestions}
            onSend={session.sendMessage}
            onFinish={session.finish}
          />
        ) : (
          <div className="practice-page-centered">
            {session.screen === "setup" && <PracticeSetup error={session.error} onStart={session.start} />}

            {session.screen === "loading-report" && (
              <div className="card practice-card" style={{ textAlign: "center" }}>
                <i className="ti ti-loader-2 spin" style={{ fontSize: 32 }} />
                <p className="sub" style={{ marginTop: "1rem" }}>
                  Generating your report…
                </p>
              </div>
            )}

            {session.screen === "report" && session.report && (
              <PracticeReport report={session.report} scorecard={session.mode === "jd" ? session.scorecard : []} onRestart={session.reset} />
            )}
          </div>
        )}
      </div>

      <footer className="practice-footer">
        Practice sessions are informal and unscored — nothing here is recorded, proctored, or reviewed.
      </footer>
    </div>
  );
}

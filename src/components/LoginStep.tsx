"use client";

import { useState, type FormEvent } from "react";
import type { AppUser, InterviewConfig } from "@/types";
import appData from "@/lib/appData.json";

interface LoginStepProps {
  onLogin: (user: AppUser) => void;
  onBack: () => void;
}

const USERS = appData.users as AppUser[];
const INTERVIEWS = appData.interviews as InterviewConfig[];

export function LoginStep({ onLogin, onBack }: LoginStepProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const user = USERS.find((u) => u.username === username.trim() && u.password === password);
    if (!user) {
      setError("Invalid username or password.");
      return;
    }
    setError("");
    onLogin(user);
  }

  function fillDemo(user: AppUser) {
    setUsername(user.username);
    setPassword(user.password);
    setError("");
  }

  return (
    <div className="card">
      <button type="button" className="back-link" onClick={onBack}>
        <i className="ti ti-arrow-left" /> Back to home
      </button>
      <div className="badge">
        <span className="dot" /> AI Interview Platform
      </div>
      <h1 className="heading" style={{ fontSize: "1.6rem" }}>Sign In</h1>
      <p className="sub">Enter your candidate credentials to begin your interview.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="username">Username</label>
          <input
            id="username"
            className="form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. user1"
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            className="form-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: "1rem" }}>
            <i className="ti ti-alert-circle" style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          Sign In →
        </button>
      </form>

      <div className="divider" />

      <div className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
        <i className="ti ti-flask" /> Demo credentials — click to autofill
      </div>
      <div className="demo-user-list">
        {USERS.map((user) => {
          const interview = INTERVIEWS.find((i) => i.id === user.interviewId);
          return (
            <button
              key={user.username}
              type="button"
              className="demo-user-btn"
              onClick={() => fillDemo(user)}
            >
              <span className="demo-user-name">{user.username}</span>
              <span className="demo-user-role">{interview?.title ?? user.interviewId}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

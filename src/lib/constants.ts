// Escalation: warning 1 (yellow) -> warning 2 (orange) -> 3rd strike disqualifies (red).
export const MAX_STRIKES = 3;

export function novaIntro(roleTitle: string): string {
  return `Hi, I'm Veda, your interviewer for the ${roleTitle} interview today. I'll ask you a few questions — take your time, answer naturally, and I'll know when you're done. Let's get started.`;
}

export const TRANSITION_PHRASES: string[] = [
  "Great, thank you for that.",
  "Nice, let's move on to the next question.",
  "Okay, great answer.",
  "Thanks for sharing that.",
  "Got it, let's continue.",
];

export const WARNING_MESSAGES: Record<string, string> = {
  TAB_CHANGE: "Tab switching is not allowed during the interview.",
  WINDOW_BLUR: "Please stay focused on the interview window.",
  MIC_DISABLED: "Your microphone has been disabled. Please re-enable it.",
  CAMERA_DISABLED: "Your webcam has been disabled. Please re-enable it.",
  SCREEN_STOPPED: "Screen sharing was stopped. Please restart screen share.",
  FACE_MISSING: "Your face is not visible. Please stay in front of the camera.",
  MULTIPLE_FACES: "Multiple faces detected. Only the candidate should be visible.",
  PHONE_DETECTED: "A phone or object was detected near your face. Please put it away.",
  FULLSCREEN_EXIT: "You exited fullscreen mode. Please return to fullscreen to continue the interview.",
  BACKGROUND_CHANGED: "Your background has changed. Please stay in a still, stable environment.",
};

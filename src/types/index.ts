import type { BodyLogEntry } from "@/hooks/useBehaviorLog";

export type InterviewStep = "home" | "login" | "landing" | "permissions" | "interview" | "processing" | "submitted";

export interface InterviewConfig {
  id: string;
  title: string;
  subtitle: string;
  questions: string[];
}

export interface AppUser {
  username: string;
  password: string;
  interviewId: string;
}

export type WarningType =
  | "TAB_CHANGE"
  | "WINDOW_BLUR"
  | "MIC_DISABLED"
  | "CAMERA_DISABLED"
  | "SCREEN_STOPPED"
  | "FACE_MISSING"
  | "MULTIPLE_FACES"
  | "PHONE_DETECTED"
  | "FULLSCREEN_EXIT"
  | "BACKGROUND_CHANGED";

export interface Warning {
  type: WarningType;
  timestamp: string;
  message: string;
  // A still frame from the webcam captured at the moment this fired — lets a reviewer see
  // what was happening without scrubbing through the full recording to find this timestamp.
  snapshot?: string;
}

export interface QuestionRecording {
  questionIndex: number;
  question: string;
  transcript: string;
  startTime: string;
  endTime: string;
  duration: number;
  // blob URLs for playback
  videoUrl: string;   // merged canvas (screen+cam) + all audio
  audioUrl: string;   // audio only
  videoBlob: Blob;
  audioBlob: Blob;
}

export interface InterviewJSON {
  interviewId: string;
  candidateId: string;
  status: "completed" | "abandoned" | "disqualified" | "rejected";
  startTime: string;
  endTime: string;
  duration: number;
  tabChange: number;
  warningCount: number;
  warnings: Warning[];
  questions: QuestionRecording[];
  bodyLog: BodyLogEntry[];
}

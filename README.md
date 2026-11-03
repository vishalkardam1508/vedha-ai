<div align="center">

# 🎙️Vedha AI Interview Platform

**Proctored video interviews with per-question recording and voice-to-text answers.**

![Next.js](https://img.shields.io/badge/Next.js-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![WebRTC](https://img.shields.io/badge/Media-MediaRecorder%20%7C%20Web%20Speech-FF6B35)

<a href="https://buymeacoffee.com/vishalkardan1508" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50">
</a>

</div>

---

## Quick Start

```bash
npm install
npm run dev       # → http://localhost:3000
```

To change port:
```bash
npm run dev -- -p 4000
```
Or edit `package.json` → `"dev": "next dev -p 4000"`

---

## What's New in v2

### 1. Per-question recording
Each question gets its own separate video + audio file. Clicking "Next Question" stops the current recording and starts a new one. Final results show all 5 recordings independently.

### 2. Voice-to-text answer input
No typing needed. The answer box is **read-only** — it fills automatically from the Web Speech API as you speak. Live "Listening…" indicator shows recognition is active. Restarts automatically if it stops.

### 3. Voice warnings (system audio)
When a tab change or window blur is detected, the browser speaks the warning aloud via `SpeechSynthesis` — you hear *"Warning. Tab switching is not allowed during the interview."*

### 4. Video + Audio modal playback
On the results screen, each question has:
- **Watch Video** → modal with `<video>` player (screen + webcam PIP + all audio)
- **Listen Audio** → modal with `<audio>` player (merged mic + system audio)
- Download buttons for each

---

## Recording Architecture

```
Screen share (getDisplayMedia)
  └─ video track → Canvas composite
  └─ audio track → AudioContext merge

Webcam (getUserMedia video)
  └─ video track → Canvas PIP overlay

Mic (getUserMedia audio)
  └─ audio track → AudioContext merge

AudioContext
  └─ mic + system audio → MediaStreamDestination

Canvas (1280×720)
  └─ screen video (full)
  └─ webcam PIP (bottom-right, 280×210)
  └─ REC indicator

Final MediaRecorder stream:
  └─ canvas.captureStream(30fps) [video]
  └─ AudioContext destination [audio]
```

Per question:
- `MediaRecorder` → `.webm` video (screen+cam+all audio)
- Second `MediaRecorder` → `.webm` audio only

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Orchestrator — all step state
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Full design system
│
├── components/
│   ├── LandingStep.tsx
│   ├── PermissionsStep.tsx   # Requests screen, webcam, mic in sequence
│   ├── InterviewStep.tsx     # Question UI + voice transcript + per-Q recording
│   ├── ProcessingStep.tsx    # Processing animation
│   ├── SubmittedStep.tsx     # Results with per-question cards
│   ├── MediaModal.tsx        # Video/audio playback modal
│   └── WarningModal.tsx      # Top toast warning
│
├── hooks/
│   ├── useQuestionRecorder.ts  # Per-question canvas+audio recording + speech recognition
│   ├── useProctoring.ts        # Tab/blur detection + SpeechSynthesis voice warnings
│   └── useTimer.ts
│
├── lib/
│   ├── constants.ts
│   └── utils.ts
│
└── types/index.ts
```

---

## Browser Requirements

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Screen capture | ✅ | ✅ | ✅ | ✅ |
| System audio | ✅ | ✅ | ❌ | ❌ |
| Speech recognition | ✅ | ✅ | ❌ | partial |
| MediaRecorder | ✅ | ✅ | ✅ | ✅ |

**Use Chrome for the best experience.**

---

## Permissions Flow

1. `getDisplayMedia({ video, audio: true })` — screen + system audio (user picks entire screen)
2. `getUserMedia({ video: true })` — webcam only
3. `getUserMedia({ audio: true })` — microphone only

---

<h1 align="center">📞 Duo Meet</h1>
<p align="center"><b>Call Workflow</b></p>

<p align="center">
🟦 WebSocket &nbsp;·&nbsp; 🟨 Through the server &nbsp;·&nbsp; 🟩 Direct, browser to browser &nbsp;·&nbsp; 🟪 Decision &nbsp;·&nbsp; 🟥 Problem shown to the user
</p>

---

## 1. WebSocket connection

How each browser stays connected to the server.

```mermaid
flowchart TD
  S([START]):::start --> A["Browser runs new WebSocket(url)"]:::ws
  A --> B["Server accepts, connection stays open"]:::ws
  B --> C["Send join with the meeting code"]:::ws
  C --> D["Messages flow both ways, anytime"]:::ws
  D --> E{"Still connected?"}:::decision
  E -->|"✅ YES"| D
  E -->|"❌ NO"| F{"User left the page?"}:::decision
  F -->|"✅ YES"| X([END]):::finish
  F -->|"❌ NO"| G["Wait a moment, then reconnect"]:::warn
  G --> A

  classDef start fill:#1D63ED,stroke:#174FC0,stroke-width:2px,color:#FFFFFF
  classDef finish fill:#DC2626,stroke:#B91C1C,stroke-width:2px,color:#FFFFFF
  classDef ws fill:#EFF6FF,stroke:#3B82F6,stroke-width:2px,color:#0F172A
  classDef decision fill:#F5F3FF,stroke:#7C3AED,stroke-width:2px,color:#0F172A
  classDef warn fill:#FEF2F2,stroke:#EF4444,stroke-width:2px,color:#0F172A
  linkStyle default stroke:#5B6B86,stroke-width:2px,stroke-dasharray:9 5,stroke-dashoffset:980,animation:dash 25s linear infinite
```

---

## 2. Meeting call

From creating a meeting to hanging up, for either person.

```mermaid
flowchart TD
  S([START]):::start --> A["Click New meeting"]:::process
  A --> B["Server creates a code: abc‑defg‑hij"]:::setup
  B --> C["Allow camera and microphone"]:::process
  C --> D{"Access allowed?"}:::decision
  D -->|"❌ NO"| D1["Show how to allow access"]:::warn
  D1 --> C
  D -->|"✅ YES"| E["Connect WebSocket and send the code"]:::ws
  E --> F{"Meeting full?"}:::decision
  F -->|"✅ YES"| F1["Show: Meeting is full"]:::warn
  F1 --> X1([END]):::finish
  F -->|"❌ NO"| G{"Someone waiting?"}:::decision
  G -->|"❌ NO"| H["Wait for someone to join"]:::ws
  H --> I["Server says: peer‑joined"]:::ws
  I --> J["Create the offer, send through server"]:::setup
  G -->|"✅ YES"| K["Receive the offer, send the answer"]:::setup
  J --> L["Exchange addresses through server"]:::setup
  K --> L
  L --> M{"Direct path works?"}:::decision
  M -->|"✅ YES"| N["Connected directly"]:::direct
  M -->|"❌ NO"| O{"TURN relay set up?"}:::decision
  O -->|"✅ YES"| P["Connect through the relay"]:::direct
  O -->|"❌ NO"| Q["Show: Can't reach them"]:::warn
  Q --> X2([END]):::finish
  N --> R["Video, audio and chat flow directly"]:::direct
  P --> R
  R --> T["Someone hangs up"]:::process
  T --> U["Server tells the other person"]:::ws
  U --> X3([END]):::finish

  classDef start fill:#1D63ED,stroke:#174FC0,stroke-width:2px,color:#FFFFFF
  classDef finish fill:#DC2626,stroke:#B91C1C,stroke-width:2px,color:#FFFFFF
  classDef process fill:#FFFFFF,stroke:#1D63ED,stroke-width:2px,color:#0F172A
  classDef ws fill:#EFF6FF,stroke:#3B82F6,stroke-width:2px,color:#0F172A
  classDef setup fill:#FFFBEB,stroke:#F59E0B,stroke-width:2px,color:#0F172A
  classDef direct fill:#ECFDF5,stroke:#10B981,stroke-width:2px,color:#0F172A
  classDef decision fill:#F5F3FF,stroke:#7C3AED,stroke-width:2px,color:#0F172A
  classDef warn fill:#FEF2F2,stroke:#EF4444,stroke-width:2px,color:#0F172A
  linkStyle default stroke:#5B6B86,stroke-width:2px,stroke-dasharray:9 5,stroke-dashoffset:980,animation:dash 25s linear infinite
```

---

> [!IMPORTANT]
> 🚫 **Video never goes through the WebSocket or the server.** Only the setup messages do.

## 👨‍💻 Creator

**Vishal Kardam**, creator and developer of AI Interview Platform.

- GitHub: [@vishalkardam1508](https://github.com/vishalkardam1508)

If this project helps you, consider supporting it:

<a href="https://buymeacoffee.com/vishalkardan1508" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50">
</a>

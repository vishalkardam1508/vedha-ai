export type AvatarState = "idle" | "speaking" | "listening" | "saving";

const CAPTIONS: Record<AvatarState, string> = {
  idle: "Veda is ready",
  speaking: "Veda is speaking…",
  listening: "Listening to your answer…",
  saving: "Saving your answer…",
};

interface InterviewerAvatarProps {
  state: AvatarState;
  /** Hide the "Veda · AI Interviewer" badge + status caption — used in the full-screen takeover, where the big spoken text already says everything. */
  hideMeta?: boolean;
}

export function InterviewerAvatar({ state, hideMeta }: InterviewerAvatarProps) {
  const isTalking = state === "speaking";

  return (
    <div className="nova-panel">
      <div className={`nova-avatar-wrap nova-avatar-wrap--${state}`}>
        <svg viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="helmetWhite" x1="90" y1="30" x2="330" y2="290">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="0.45" stopColor="#EDF3F7" />
              <stop offset="1" stopColor="#BBC9D4" />
            </linearGradient>

            <linearGradient id="helmetEdge" x1="85" y1="100" x2="340" y2="275">
              <stop offset="0" stopColor="#6C7E91" />
              <stop offset="0.35" stopColor="#243242" />
              <stop offset="0.7" stopColor="#121C29" />
              <stop offset="1" stopColor="#5E7082" />
            </linearGradient>

            <radialGradient id="skin" cx="48%" cy="37%" r="67%">
              <stop offset="0" stopColor="#FFE5CC" />
              <stop offset="0.48" stopColor="#F1C9AA" />
              <stop offset="1" stopColor="#BE896C" />
            </radialGradient>

            <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#E9997E" stopOpacity=".38" />
              <stop offset="1" stopColor="#E9997E" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="irisBrown" cx="38%" cy="35%" r="60%">
              <stop offset="0" stopColor="#B97B4C" />
              <stop offset=".35" stopColor="#7A4628" />
              <stop offset=".75" stopColor="#3A2119" />
              <stop offset="1" stopColor="#190F0D" />
            </radialGradient>

            <radialGradient id="pupilGlow" cx="35%" cy="30%" r="55%">
              <stop offset="0" stopColor="#523127" />
              <stop offset="1" stopColor="#0A0807" />
            </radialGradient>

            <linearGradient id="visorGlass" x1="110" y1="105" x2="312" y2="280">
              <stop offset="0" stopColor="#3D4B5B" stopOpacity=".24" />
              <stop offset=".45" stopColor="#172535" stopOpacity=".05" />
              <stop offset="1" stopColor="#000A12" stopOpacity=".24" />
            </linearGradient>

            <clipPath id="faceClip">
              <rect x="103" y="106" width="214" height="166" rx="79" />
            </clipPath>
          </defs>

          <g>
            <path
              d="M210 18 C133 18 78 61 66 126 C56 177 64 240 94 282 C117 306 156 317 210 318 C264 317 303 306 326 282 C356 240 364 177 354 126 C342 61 287 18 210 18Z"
              fill="url(#helmetWhite)"
            />

            <path
              d="M110 79 C132 41 169 26 210 25 C250 25 285 41 310 76 C272 54 233 46 193 49 C161 51 135 60 110 79Z"
              fill="#FFFFFF"
              opacity=".64"
            />

            <g>
              <ellipse cx="67" cy="170" rx="24" ry="54" fill="#C4D9E8" />
              <ellipse cx="66" cy="169" rx="14" ry="37" fill="#7C97AE" />
              <ellipse cx="66" cy="169" rx="9" ry="29" fill="#273849" />
              <path d="M59 145 Q67 136 75 145" stroke="#E3F5FF" strokeWidth="4" strokeLinecap="round" />
            </g>

            <g>
              <ellipse cx="353" cy="170" rx="24" ry="54" fill="#C4D9E8" />
              <ellipse cx="354" cy="169" rx="14" ry="37" fill="#7C97AE" />
              <ellipse cx="354" cy="169" rx="9" ry="29" fill="#273849" />
              <path d="M345 145 Q353 136 361 145" stroke="#E3F5FF" strokeWidth="4" strokeLinecap="round" />
            </g>

            <rect x="82" y="84" width="256" height="211" rx="92" fill="url(#helmetEdge)" />
            <rect x="91" y="93" width="238" height="193" rx="84" fill="#899AA9" />
            <rect x="99" y="101" width="222" height="177" rx="80" fill="#192431" />

            {/* Subtle always-on breathing bob, independent of speaking state */}
            <g className="nova-face-bob">
              <g clipPath="url(#faceClip)">
                <rect x="103" y="106" width="214" height="166" rx="79" fill="url(#skin)" />

                <ellipse cx="205" cy="123" rx="93" ry="57" fill="#FFEEDC" opacity=".26" />

                <ellipse cx="141" cy="218" rx="40" ry="34" fill="url(#cheek)" />
                <ellipse cx="279" cy="218" rx="40" ry="34" fill="url(#cheek)" />

                <g fill="#A76B54" opacity=".32">
                  <circle cx="252" cy="189" r="1.6" />
                  <circle cx="260" cy="192" r="1.4" />
                  <circle cx="267" cy="196" r="1.5" />
                  <circle cx="272" cy="188" r="1.3" />
                  <circle cx="278" cy="195" r="1.1" />
                  <circle cx="150" cy="191" r="1.2" />
                  <circle cx="157" cy="195" r="1.1" />
                </g>

                <g className="nova-eye">
                  <ellipse cx="151" cy="179" rx="39" ry="41" fill="#FFF4E8" />
                  <ellipse cx="151" cy="181" rx="31" ry="34" fill="url(#irisBrown)" />
                  <circle cx="151" cy="183" r="18" fill="url(#pupilGlow)" />
                  <circle cx="151" cy="184" r="9" fill="#090706" />
                  <ellipse cx="140" cy="168" rx="8.5" ry="10" fill="#FFFFFF" opacity=".92" />
                  <circle cx="160" cy="194" r="3" fill="#FFFFFF" opacity=".42" />
                </g>

                <g className="nova-eye">
                  <ellipse cx="268" cy="179" rx="39" ry="41" fill="#FFF4E8" />
                  <ellipse cx="268" cy="181" rx="31" ry="34" fill="url(#irisBrown)" />
                  <circle cx="268" cy="183" r="18" fill="url(#pupilGlow)" />
                  <circle cx="268" cy="184" r="9" fill="#090706" />
                  <ellipse cx="257" cy="168" rx="8.5" ry="10" fill="#FFFFFF" opacity=".92" />
                  <circle cx="277" cy="194" r="3" fill="#FFFFFF" opacity=".42" />
                </g>

                <g>
                  <path
                    className="nova-brow nova-brow-left"
                    d="M122 145 C134 136 150 134 165 140 C168 141 170 144 169 147 C168 150 165 151 162 150 C150 146 137 147 127 152 C123 154 120 152 119 149 C118 147 120 146 122 145Z"
                    fill="#6D4A42"
                  />
                  <path
                    className="nova-brow nova-brow-right"
                    d="M247 141 C260 134 275 134 289 140 C293 142 295 145 293 148 C292 151 289 152 286 150 C274 146 261 146 250 150 C247 151 244 150 243 147 C242 145 244 143 247 141Z"
                    fill="#84533F"
                  />
                </g>

                <g>
                  <ellipse cx="209" cy="203" rx="12" ry="10" fill="#D7A185" opacity=".09" />
                  <ellipse cx="208.5" cy="204" rx="4" ry="3" fill="#FFE0C7" opacity=".38" />
                  <ellipse cx="204" cy="210" rx="2.2" ry="1.3" fill="#8F5D4C" opacity=".28" />
                  <ellipse cx="214" cy="210" rx="2.2" ry="1.3" fill="#8F5D4C" opacity=".28" />
                  <path
                    d="M201 209 C204 213 214 213 217 209"
                    stroke="#A76F59"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    opacity=".34"
                  />
                </g>

                {/* Talking mouth — a real cavity + inner lip, animated via CSS while she's speaking */}
                <g>
                  <path
                    className={`nova-mouth-cavity${isTalking ? " nova-mouth-cavity--talk" : ""}`}
                    d="M192 236 C197 232 203 230 210 230 C217 230 223 232 228 236 C227 243 220 247 210 247 C200 247 193 243 192 236Z"
                    fill="#5A403C"
                  />
                  <path
                    className={`nova-inner-lip${isTalking ? " nova-inner-lip--talk" : ""}`}
                    d="M198 242 C202 244 206 245 210 245 C214 245 218 244 222 242 C219 246 215 247 210 247 C205 247 201 246 198 242Z"
                    fill="#C58A82"
                  />
                </g>
              </g>
            </g>

            <rect x="100" y="102" width="220" height="175" rx="79" fill="url(#visorGlass)" pointerEvents="none" />
            <path
              d="M118 132 C152 108 198 103 239 111 C184 118 143 138 113 172 C109 154 111 142 118 132Z"
              fill="#FFFFFF"
              opacity=".06"
              pointerEvents="none"
            />
          </g>
        </svg>
      </div>
      {!hideMeta && (
        <div className="nova-meta">
          <div className="badge" style={{ marginBottom: 0 }}>
            <span className="dot" /> Veda · AI Interviewer
          </div>
          <div className="hint" style={{ marginTop: 6 }}>{CAPTIONS[state]}</div>
        </div>
      )}
    </div>
  );
}

import type { ThinkingStatus } from '../store/chat'

function CatSvg() {
  return (
    <svg width="38" height="32" viewBox="0 0 40 34" fill="none" aria-hidden="true">
      {/* tail */}
      <g className="sohano-tail">
        <path
          d="M6 24 C -2 22, -1 12, 5 10"
          stroke="#ea580c"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </g>
      {/* body */}
      <ellipse cx="17" cy="25" rx="12" ry="7.5" fill="#f97316" />
      {/* head */}
      <circle cx="30" cy="15" r="7" fill="#f97316" />
      {/* ears */}
      <path d="M25.4 10 L24.4 3.8 L29.4 7.4 Z" fill="#f97316" />
      <path d="M33 9.4 L34.6 3.6 L37.4 9 Z" fill="#f97316" />
      <path d="M26.1 9 L25.6 5.8 L28.4 7.8 Z" fill="#fed7aa" />
      <path d="M33.5 8.6 L34.5 5.6 L36.1 8.6 Z" fill="#fed7aa" />
      {/* face */}
      <circle cx="32.6" cy="14.2" r="1.15" fill="#27272a">
        <animate
          attributeName="ry"
          values="1.15;1.15;0.15;1.15"
          keyTimes="0;0.9;0.94;1"
          dur="3.4s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="27.8" cy="14.2" r="1.15" fill="#27272a" />
      <path d="M29.2 16.8 Q30.2 18 31.2 16.8" stroke="#7c2d12" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <ellipse cx="30.2" cy="16" rx="0.9" ry="0.65" fill="#fb923c" />
    </svg>
  )
}

function MouseSvg() {
  return (
    <svg width="24" height="20" viewBox="0 0 26 22" fill="none" aria-hidden="true">
      {/* tail */}
      <path
        d="M5 17 C -1 15, 0 9, 4 8"
        stroke="#a1a1aa"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* body */}
      <path
        d="M23 14 C 23 18, 17 20.5, 12 20 C 7.5 19.6, 5 17, 5.5 13.5 C 6 10, 11 8.5, 15 9.5 C 19.5 10.5, 23 11.5, 23 14 Z"
        fill="#a1a1aa"
      />
      {/* ear */}
      <circle cx="12.5" cy="8.5" r="3.1" fill="#d4d4d8" />
      <circle cx="12.5" cy="8.5" r="1.7" fill="#f4a7b9" />
      {/* eye */}
      <circle cx="19.6" cy="13.4" r="0.95" fill="#18181b" />
      {/* nose */}
      <circle cx="23.4" cy="13.8" r="1" fill="#f4a7b9" />
      {/* whiskers */}
      <path d="M21.4 15.2 L24 16.6 M20.8 15.8 L22.6 18" stroke="#d4d4d8" strokeWidth="0.7" strokeLinecap="round" />
    </svg>
  )
}

function Stars() {
  return (
    <svg className="sohano-stars absolute left-[155px] top-[-2px]" width="26" height="18" viewBox="0 0 26 18" aria-hidden="true">
      <text x="0" y="14" fontSize="12" fill="#fbbf24">✦</text>
      <text x="12" y="10" fontSize="9" fill="#fb923c">✦</text>
      <text x="19" y="15" fontSize="7" fill="#facc15">✦</text>
    </svg>
  )
}

export default function ThinkingIndicator({ status }: { status: ThinkingStatus }) {
  const label =
    status === 'thinking' ? 'Sohano is thinking…' : status === 'caught' ? 'Got it!' : ''
  return (
    <div
      className="sohano-scene select-none"
      data-status={status}
      role="img"
      aria-label={label || 'Sohano.ai'}
      title={label || 'Sohano.ai'}
    >
      <div className="sohano-ground" />
      {status === 'caught' && <Stars />}
      <span className="sohano-cat">
        <span className="sohano-cat-inner block">
          <CatSvg />
        </span>
      </span>
      <span className="sohano-mouse">
        <span className="sohano-mouse-inner block">
          <MouseSvg />
        </span>
      </span>
    </div>
  )
}

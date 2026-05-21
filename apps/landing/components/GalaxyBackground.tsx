'use client';

export default function GalaxyBackground() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      background: '#fafaf8',
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style={{ opacity: 0.07 }}>
        <defs>
          <pattern id="doodles" x="0" y="0" width="400" height="400" patternUnits="userSpaceOnUse">
            {/* Brain */}
            <path d="M44 80 Q34 70 38 58 Q43 44 55 47 Q58 38 68 40 Q73 32 83 35 Q93 32 98 40 Q110 37 115 50 Q127 47 131 62 Q136 76 124 84 Q131 99 121 106 Q111 114 101 108 Q96 114 86 114 Q76 114 71 108 Q61 114 51 106 Q41 99 44 84Z" stroke="#111" strokeWidth="1.5" fill="none"/>
            <path d="M86 47 Q86 70 86 114" stroke="#111" strokeWidth="1" fill="none" strokeDasharray="4 4"/>
            <path d="M68 62 Q78 70 98 62" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            <path d="M68 82 Q78 90 98 82" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round"/>

            {/* Lightbulb */}
            <path d="M310 52 Q310 37 320 30 Q335 22 338 37 Q342 50 334 60 L306 60 Q298 50 302 37 Q305 22 320 30" stroke="#111" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path d="M307 63 L333 63 M309 69 L331 69 M315 75 L325 75" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            <line x1="320" y1="20" x2="320" y2="12" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="332" y1="24" x2="338" y2="18" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="308" y1="24" x2="302" y2="18" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>

            {/* Chat bubble */}
            <path d="M20 250 Q20 238 28 238 L90 238 Q98 238 98 246 L98 268 Q98 276 90 276 L58 276 L46 286 L50 276 L28 276 Q20 276 20 268 Z" stroke="#111" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path d="M34 252 L84 252 M34 260 L72 260 M34 268 L64 268" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round"/>

            {/* Star */}
            <path d="M200 20 L204 32 L218 32 L207 40 L211 52 L200 44 L189 52 L193 40 L182 32 L196 32 Z" stroke="#111" strokeWidth="1.5" fill="none"/>

            {/* Arrow right */}
            <path d="M150 200 L185 200 M176 192 L185 200 L176 208" stroke="#111" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Arrow down */}
            <path d="M260 150 L260 185 M252 176 L260 185 L268 176" stroke="#111" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Circle target */}
            <circle cx="340" cy="280" r="22" stroke="#111" strokeWidth="1.5" fill="none"/>
            <circle cx="340" cy="280" r="12" stroke="#111" strokeWidth="1" fill="none"/>
            <circle cx="340" cy="280" r="3" fill="#111"/>

            {/* Checkmark circle */}
            <circle cx="80" cy="340" r="20" stroke="#111" strokeWidth="1.5" fill="none"/>
            <path d="M70 340 L78 348 L92 330" stroke="#111" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Wavy line */}
            <path d="M120 140 Q140 120 160 140 Q180 160 200 140 Q220 120 240 140 Q260 160 280 140" stroke="#111" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

            {/* Spiral */}
            <path d="M370 180 Q380 175 382 185 Q384 198 372 202 Q358 206 353 192 Q348 175 362 168 Q378 160 386 178 Q394 198 378 208" stroke="#111" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

            {/* Three dots */}
            <circle cx="155" cy="330" r="3" fill="#111"/>
            <circle cx="168" cy="330" r="3" fill="#111"/>
            <circle cx="181" cy="330" r="3" fill="#111"/>

            {/* Small cross */}
            <path d="M290 100 L290 120 M280 110 L300 110" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>

            {/* Zigzag */}
            <path d="M20 170 L36 155 L52 170 L68 155 L84 170 L100 155 L116 170" stroke="#111" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Quote marks */}
            <path d="M220 280 Q220 268 230 268 L242 268 L242 284 L228 284 Q220 284 220 276 Z" stroke="#111" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path d="M250 280 Q250 268 260 268 L272 268 L272 284 L258 284 Q250 284 250 276 Z" stroke="#111" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#doodles)"/>
      </svg>
    </div>
  );
}

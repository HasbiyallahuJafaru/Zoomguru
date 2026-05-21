'use client';

export default function GalaxyBackground() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      background: '#ffffff',
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        style={{ opacity: 0.13 }}
      >
        <defs>
          <pattern id="doodles" x="0" y="0" width="320" height="320" patternUnits="userSpaceOnUse">
            {/* Wavy lines */}
            <path d="M10 30 Q30 10 50 30 Q70 50 90 30 Q110 10 130 30" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path d="M180 80 Q200 60 220 80 Q240 100 260 80 Q280 60 300 80" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round"/>

            {/* Stars */}
            <path d="M160 20 L163 28 L172 28 L165 33 L168 42 L160 37 L152 42 L155 33 L148 28 L157 28 Z" stroke="#1a1a2e" strokeWidth="1.5" fill="none"/>
            <path d="M60 180 L62 186 L68 186 L63 190 L65 196 L60 193 L55 196 L57 190 L52 186 L58 186 Z" stroke="#1a1a2e" strokeWidth="1.5" fill="none"/>
            <path d="M270 240 L272 246 L278 246 L273 250 L275 256 L270 253 L265 256 L267 250 L262 246 L268 246 Z" stroke="#1a1a2e" strokeWidth="1.5" fill="none"/>

            {/* Circles */}
            <circle cx="240" cy="40" r="14" stroke="#1a1a2e" strokeWidth="2" fill="none"/>
            <circle cx="240" cy="40" r="7" stroke="#1a1a2e" strokeWidth="1" fill="none"/>
            <circle cx="80" cy="260" r="18" stroke="#1a1a2e" strokeWidth="2" fill="none"/>
            <circle cx="80" cy="260" r="9" stroke="#1a1a2e" strokeWidth="1" fill="none"/>

            {/* Arrows */}
            <path d="M130 150 L155 150 M148 143 L155 150 L148 157" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M200 200 L200 225 M193 218 L200 225 L207 218" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Lightbulb */}
            <path d="M290 140 Q290 125 300 118 Q315 110 318 125 Q322 138 314 148 L286 148 Q278 138 282 125 Q285 110 300 118" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path d="M287 151 L313 151 M289 157 L311 157 M295 163 L305 163" stroke="#1a1a2e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <line x1="300" y1="108" x2="300" y2="100" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round"/>
            <line x1="312" y1="112" x2="318" y2="106" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round"/>
            <line x1="288" y1="112" x2="282" y2="106" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round"/>

            {/* Brain outline */}
            <path d="M30 100 Q20 90 25 78 Q30 65 42 68 Q45 58 55 60 Q60 52 70 55 Q80 52 85 60 Q96 58 98 68 Q110 65 115 78 Q120 92 108 100 Q115 115 105 122 Q95 130 85 124 Q80 130 70 130 Q60 130 55 124 Q45 130 35 122 Q25 115 30 100Z" stroke="#1a1a2e" strokeWidth="2" fill="none"/>
            <path d="M70 68 Q70 90 70 130" stroke="#1a1a2e" strokeWidth="1" fill="none" strokeDasharray="3 3"/>
            <path d="M55 80 Q65 88 80 80" stroke="#1a1a2e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path d="M55 100 Q65 108 80 100" stroke="#1a1a2e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

            {/* Checkmark in circle */}
            <circle cx="200" cy="280" r="16" stroke="#1a1a2e" strokeWidth="2" fill="none"/>
            <path d="M192 280 L198 286 L210 274" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Chat bubble */}
            <path d="M20 200 Q20 188 28 188 L80 188 Q88 188 88 196 L88 218 Q88 226 80 226 L50 226 L38 236 L42 226 L28 226 Q20 226 20 218 Z" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path d="M32 203 L76 203 M32 211 L65 211 M32 219 L58 219" stroke="#1a1a2e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

            {/* Zigzag */}
            <path d="M150 280 L165 265 L180 280 L195 265 L210 280 L225 265 L240 280" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Dots */}
            <circle cx="140" cy="60" r="3" fill="#1a1a2e"/>
            <circle cx="152" cy="60" r="3" fill="#1a1a2e"/>
            <circle cx="164" cy="60" r="3" fill="#1a1a2e"/>

            {/* Spiral */}
            <path d="M260 160 Q270 155 272 165 Q274 178 262 182 Q248 186 243 172 Q238 155 252 148 Q268 140 276 158 Q284 178 268 188" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round"/>

            {/* Small cross */}
            <path d="M140 230 L140 250 M130 240 L150 240" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round"/>
            <path d="M295 295 L295 315 M285 305 L305 305" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#doodles)"/>
      </svg>
    </div>
  );
}

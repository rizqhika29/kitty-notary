interface CatProps {
  className?: string;
}

function WhiskerL({ className }: { className?: string }) {
  return (
    <g className={className} stroke="hsl(340 20% 55%)" strokeWidth="2" fill="none" strokeLinecap="round">
      <path d="M58 92 Q40 89 30 93" />
      <path d="M58 102 Q42 106 31 110" />
    </g>
  );
}

function WhiskerR({ className }: { className?: string }) {
  return (
    <g className={className} stroke="hsl(340 20% 55%)" strokeWidth="2" fill="none" strokeLinecap="round">
      <path d="M142 92 Q160 89 170 93" />
      <path d="M142 102 Q158 106 169 110" />
    </g>
  );
}

/** Chubby kawaii white cat mascot - big round head, sparkling eyes, plump body. */
export function KittyCartoon({ className }: CatProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* fluffy tail behind body */}
      <g
        className="svg-anchor animate-tail-wag"
        style={{ transformOrigin: "50% 80%" }}
      >
        <path
          d="M138 168 C 172 162 186 150 188 128 C 190 110 172 102 162 114 C 156 122 160 132 170 130"
          fill="none"
          stroke="#ffffff"
          strokeWidth="20"
          strokeLinecap="round"
        />
        <path
          d="M138 168 C 172 162 186 150 188 128 C 190 110 172 102 162 114 C 156 122 160 132 170 130"
          fill="none"
          stroke="hsl(350 90% 88%)"
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray="0 30 20 30"
          opacity="0.5"
        />
      </g>

      {/* chubby body */}
      <path
        d="M100 130 C 58 130 44 146 44 168 C 44 186 58 194 100 194 C 142 194 156 186 156 168 C 156 146 142 130 100 130 Z"
        fill="#ffffff"
      />
      {/* belly */}
      <ellipse cx="100" cy="174" rx="38" ry="22" fill="hsl(350 100% 95%)" />

      {/* front paws */}
      <g className="svg-anchor">
        <g className="animate-paw-tap">
          <ellipse cx="76" cy="190" rx="16" ry="12" fill="#ffffff" />
          <path d="M68 193 q3 -4 7 -4 q4 0 7 4" stroke="hsl(340 25% 78%)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
        <g className="animate-paw-tap" style={{ animationDelay: "0.5s" }}>
          <ellipse cx="124" cy="190" rx="16" ry="12" fill="#ffffff" />
          <path d="M116 193 q3 -4 7 -4 q4 0 7 4" stroke="hsl(340 25% 78%)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      </g>

      {/* shadow */}
      <ellipse cx="100" cy="197" rx="60" ry="6" fill="hsl(340 60% 80% / 0.45)" />

      {/* big round head */}
      <g className="svg-anchor">
        <circle cx="100" cy="78" r="60" fill="#ffffff" />

        {/* rounded ears */}
        <path d="M50 52 L34 12 Q30 2 42 6 Q66 14 84 34 Q78 52 50 52 Z" fill="#ffffff" />
        <path d="M150 52 L166 12 Q170 2 158 6 Q134 14 116 34 Q122 52 150 52 Z" fill="#ffffff" />
        <g className="svg-anchor animate-ear-twitch">
          <path d="M48 43 L39 18 Q37 10 42 13 Q58 20 68 28 Q64 40 48 43 Z" fill="hsl(350 95% 88%)" />
        </g>
        <g className="svg-anchor animate-ear-twitch" style={{ animationDelay: "1.1s" }}>
          <path d="M152 43 L161 18 Q163 10 158 13 Q142 20 132 28 Q136 40 152 43 Z" fill="hsl(350 95% 88%)" />
        </g>

        {/* sparkly eyes */}
        <g className="svg-anchor animate-cat-blink">
          <ellipse cx="76" cy="86" rx="13" ry="14" fill="hsl(285 25% 14%)" />
          <circle cx="71" cy="80" r="5.5" fill="#ffffff" />
          <circle cx="81" cy="91" r="2.4" fill="#ffffff" opacity="0.9" />
        </g>
        <g className="svg-anchor animate-cat-blink" style={{ animationDelay: "0.12s" }}>
          <ellipse cx="124" cy="86" rx="13" ry="14" fill="hsl(285 25% 14%)" />
          <circle cx="119" cy="80" r="5.5" fill="#ffffff" />
          <circle cx="129" cy="91" r="2.4" fill="#ffffff" opacity="0.9" />
        </g>

        {/* blush */}
        <ellipse cx="52" cy="106" rx="11" ry="7" fill="hsl(350 95% 89%)" opacity="0.9" />
        <ellipse cx="148" cy="106" rx="11" ry="7" fill="hsl(350 95% 89%)" opacity="0.9" />

        {/* nose + mouth */}
        <path d="M93 103 L107 103 L100 111 Z" fill="hsl(340 90% 74%)" stroke="hsl(340 90% 74%)" strokeWidth="1" strokeLinejoin="round" />
        <path d="M100 110 C 97 112 96 114 98 115 C 99 116 100 114 100 112 Z" fill="hsl(340 40% 45%)" />
        <path d="M100 110 C 103 112 104 114 102 115 C 101 116 100 114 100 112 Z" fill="hsl(340 40% 45%)" />

        {/* whiskers */}
        <WhiskerL />
        <WhiskerR />
      </g>
    </svg>
  );
}

/** Small kawaii white cat face for UI accents. */
export function CatFace({ className }: CatProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M20 30 L13 8 Q11 2 18 7 L30 18 Q25 16 24 22 Z" fill="#ffffff" />
      <path d="M44 30 L51 8 Q53 2 46 7 L34 18 Q39 16 40 22 Z" fill="#ffffff" />
      <circle cx="32" cy="34" r="22" fill="#ffffff" />
      <path d="M13 10 Q10 2 17 6 L28 17 Q23 16 22 22 Z" fill="hsl(350 95% 88%)" />
      <path d="M51 10 Q54 2 47 6 L36 17 Q41 16 42 22 Z" fill="hsl(350 95% 88%)" />
      <g className="animate-cat-blink">
        <ellipse cx="26" cy="34" rx="4.6" ry="5" fill="hsl(285 25% 14%)" />
        <circle cx="25" cy="33" r="1.7" fill="#ffffff" />
      </g>
      <g className="animate-cat-blink" style={{ animationDelay: "0.12s" }}>
        <ellipse cx="38" cy="34" rx="4.6" ry="5" fill="hsl(285 25% 14%)" />
        <circle cx="37" cy="33" r="1.7" fill="#ffffff" />
      </g>
      <ellipse cx="21" cy="43" rx="3.6" ry="2.6" fill="hsl(350 95% 89%)" />
      <ellipse cx="43" cy="43" rx="3.6" ry="2.6" fill="hsl(350 95% 89%)" />
      <path d="M30.5 42 L33.5 42 L32 45.5 Z" fill="hsl(340 90% 74%)" />
      <path d="M32 45.5 C 31 46.5 30.6 48 31.5 48 C 32 48.2 32 46.8 32 46 C 32 46.8 32 48.2 32.5 48 C 33.4 48 33 46.5 32 45.5 Z" fill="hsl(340 40% 45%)" />
    </svg>
  );
}

export function PawPrint({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="6" cy="9" rx="2.6" ry="3.2" transform="rotate(-15 6 9)" />
      <ellipse cx="18" cy="9" rx="2.6" ry="3.2" transform="rotate(15 18 9)" />
      <ellipse cx="8" cy="15" rx="2.4" ry="3" transform="rotate(-8 8 15)" />
      <ellipse cx="16" cy="15" rx="2.4" ry="3" transform="rotate(8 16 15)" />
      <ellipse cx="12" cy="18" rx="4.2" ry="3.6" />
    </svg>
  );
}

/** Cute upside-down cat butt (classic meme energy) silhouette. */
export function CatSilhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 84"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="60" cy="70" rx="36" ry="8" fill="hsl(340 60% 80% / 0.5)" />
      <path
        d="M32 66 L12 20 L42 40 Q44 18 60 18 Q76 18 78 40 L108 20 L88 66 Q74 72 60 72 Q46 72 32 66 Z"
        fill="#ffffff"
      />
      <path d="M34 54 q-6 4 -4 10" stroke="hsl(340 30% 78%)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M86 54 q6 4 4 10" stroke="hsl(340 30% 78%)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
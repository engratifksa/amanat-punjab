export function AmanatLogo({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="amanatBg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#065F46" />
          <stop offset="55%" stopColor="#064E3B" />
          <stop offset="100%" stopColor="#022C22" />
        </linearGradient>
        <linearGradient id="amanatGold" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="48%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="amanatGoldSoft" x1="10" y1="12" x2="54" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <radialGradient id="amanatGem" cx="50%" cy="44%" r="54%">
          <stop offset="0%" stopColor="#D1FAE5" />
          <stop offset="55%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
      </defs>

      {/* Deep Emerald Rounded Emblem Base */}
      <rect width="64" height="64" rx="16" fill="url(#amanatBg)" />
      <rect
        x="1.5"
        y="1.5"
        width="61"
        height="61"
        rx="14.5"
        stroke="url(#amanatGold)"
        strokeOpacity="0.48"
        strokeWidth="1.5"
      />

      {/* Subtle Islamic 8-Point Verification Seal */}
      <g opacity="0.16" stroke="#FDE68A" strokeWidth="1">
        <rect x="16" y="16" width="32" height="32" rx="3" />
        <rect x="16" y="16" width="32" height="32" rx="3" transform="rotate(45 32 32)" />
      </g>

      {/* 1. UPPER GIVING HAND — Entrusting the Asset from Above */}
      <path
        d="M11 16.5H20.5C23.4 16.5 26.2 17.5 28.4 19.3L33.2 23.1C34.2 23.9 33.7 25.4 32.4 25.4H26.4C25.1 25.4 23.9 24.9 22.9 24.1L20.6 22.3H11V16.5Z"
        fill="url(#amanatGoldSoft)"
      />
      {/* Subtle cuff accent on giving hand */}
      <rect x="9.5" y="15.5" width="3.2" height="8" rx="1.6" fill="#FEF3C7" />

      {/* 2. CENTER PROTECTED ASSET — Shielded Emerald-Gold Trust (Amanat) */}
      <path
        d="M32 21.5L41.5 25.2V32.4C41.5 38.4 37.4 42.9 32 45C26.6 42.9 22.5 38.4 22.5 32.4V25.2L32 21.5Z"
        fill="url(#amanatGem)"
        stroke="url(#amanatGold)"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      {/* Inner Faceted Trust Gem / Verified Check Spark */}
      <path
        d="M32 27.2L35.8 32.4L32 37.8L28.2 32.4L32 27.2Z"
        fill="#FEF3C7"
        fillOpacity="0.92"
      />
      <circle cx="32" cy="32.4" r="1.4" fill="#065F46" />

      {/* 3. LOWER RECEIVING HAND — Handing Over Safely to the Deserving */}
      <path
        d="M53 47.5H42.6C39.2 47.5 35.9 46.4 33.2 44.4L27.6 40.3C26.4 39.4 27 37.6 28.5 37.6H35.2C36.8 37.6 38.3 38.2 39.5 39.1L42.8 41.7H53V47.5Z"
        fill="url(#amanatGold)"
      />
      {/* Subtle cuff accent on receiving hand */}
      <rect x="51.3" y="40.5" width="3.2" height="8" rx="1.6" fill="#FEF3C7" />

      {/* Directional Trust Flow Arcs connecting Giver -> Shield -> Recipient */}
      <path
        d="M42 15.5C47.5 18.8 50.8 24.5 51 31"
        stroke="#FDE68A"
        strokeOpacity="0.55"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="2.5 3"
      />
      <path
        d="M22 48.5C16.5 45.2 13.2 39.5 13 33"
        stroke="#6EE7B7"
        strokeOpacity="0.55"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="2.5 3"
      />
    </svg>
  );
}

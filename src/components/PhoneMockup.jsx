// A hand-drawn SVG mockup of the DaySpace app, rendered inside a phone frame.
// Not a screenshot — a clean, deliberate illustration of the timeline UI.
const HEX = { indigo:'#6366F1', amber:'#F59E0B', violet:'#8B5CF6', green:'#22C55E', rose:'#F43F5E', sky:'#0EA5E9' }

const BLOCKS = [
  { y: 78, h: 34, color: HEX.amber, title: 'אימון בוקר', time: '07:00 · 45 דק׳', done: true },
  { y: 122, h: 46, color: HEX.indigo, title: 'ישיבת צוות', time: '10:00 · שעה', flag: true },
  { y: 176, h: 30, color: HEX.green, title: 'ארוחת צהריים', time: '12:30' },
  { y: 214, h: 72, color: HEX.violet, title: 'זמן ריכוז — פרויקט', time: '14:00 · שעתיים', flag: true },
  { y: 296, h: 38, color: HEX.rose, title: 'שיחה עם אמא', time: '18:00' },
]

const HOURS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']

export default function PhoneMockup({ className = '' }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 340 700" className="w-full h-auto drop-shadow-[0_40px_80px_rgba(80,50,180,0.35)]" aria-label="הדגמת אפליקציית DaySpace">
        {/* phone frame */}
        <rect x="6" y="6" width="328" height="688" rx="44" fill="#0D0C17" />
        <rect x="10" y="10" width="320" height="680" rx="40" fill="#F4F4FB" />
        {/* notch */}
        <rect x="132" y="16" width="76" height="20" rx="10" fill="#0D0C17" />

        {/* header (gradient) */}
        <defs>
          <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366F1" />
            <stop offset=".5" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#D946EF" />
          </linearGradient>
          <clipPath id="scr"><rect x="14" y="42" width="312" height="612" rx="30" /></clipPath>
        </defs>

        <g clipPath="url(#scr)">
          <rect x="14" y="42" width="312" height="94" fill="url(#hdr)" />
          {/* header text (RTL: title right, controls left) */}
          <text x="308" y="72" fill="#fff" fontSize="17" fontWeight="800" textAnchor="end" fontFamily="Heebo, sans-serif">היום</text>
          <text x="308" y="90" fill="rgba(255,255,255,.8)" fontSize="10.5" textAnchor="end" fontFamily="Heebo, sans-serif">יום חמישי, 9 ביולי</text>
          {/* streak chip */}
          <g transform="translate(36,60)">
            <rect width="52" height="22" rx="11" fill="rgba(255,255,255,.22)" />
            <text x="26" y="15" fill="#fff" fontSize="11" fontWeight="800" textAnchor="middle" fontFamily="Heebo, sans-serif">🔥 7</text>
          </g>
          {/* progress bar */}
          <text x="308" y="112" fill="rgba(255,255,255,.9)" fontSize="9.5" textAnchor="end" fontFamily="Heebo, sans-serif">1 מתוך 5 הושלמו</text>
          <text x="34" y="112" fill="#fff" fontSize="10" fontWeight="800" fontFamily="Heebo, sans-serif">20%</text>
          <rect x="30" y="118" width="280" height="6" rx="3" fill="rgba(255,255,255,.28)" />
          <rect x="30" y="118" width="56" height="6" rx="3" fill="#fff" />

          {/* timeline area */}
          <g transform="translate(0,140)">
            {/* hour rows */}
            {HOURS.map((h, i) => (
              <g key={h}>
                <text x="42" y={i * 40 + 12} fill="#94A3B8" fontSize="9" textAnchor="middle" fontFamily="Heebo, sans-serif" style={{ fontVariantNumeric: 'tabular-nums' }}>{h}</text>
                <line x1="58" y1={i * 40 + 8} x2="316" y2={i * 40 + 8} stroke="#E2E8F0" strokeWidth="1" />
              </g>
            ))}
            {/* now line */}
            <g>
              <rect x="20" y="145" width="42" height="14" rx="3" fill="#EF4444" />
              <text x="41" y="155" fill="#fff" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="Heebo, sans-serif">14:24</text>
              <line x1="62" y1="152" x2="316" y2="152" stroke="#EF4444" strokeWidth="2" />
              <circle cx="316" cy="152" r="3" fill="#EF4444" />
            </g>

            {/* blocks */}
            {BLOCKS.map((b, i) => {
              const isLight = b.color === HEX.amber
              const txt = isLight ? '#1B1930' : '#fff'
              return (
                <g key={i}>
                  <rect x="66" y={b.y} width="248" height={b.h} rx="10" fill={b.color} opacity={b.done ? 0.55 : 1} />
                  {/* icon chip */}
                  <rect x="74" y={b.y + 6} width="18" height="18" rx="6" fill={isLight ? 'rgba(15,23,42,.15)' : 'rgba(255,255,255,.22)'} />
                  <text x="83" y={b.y + 19} fontSize="10" textAnchor="middle" fill={txt} fontFamily="Heebo, sans-serif">✓</text>
                  <text x="306" y={b.y + 15} fill={txt} fontSize="11" fontWeight="700" textAnchor="end" fontFamily="Heebo, sans-serif" textDecoration={b.done ? 'line-through' : 'none'}>{b.title}</text>
                  {b.h > 34 && <text x="306" y={b.y + 28} fill={txt} opacity=".85" fontSize="9.5" textAnchor="end" fontFamily="Heebo, sans-serif">{b.time}</text>}
                  {b.flag && <text x="94" y={b.y + 15} fontSize="9" fill={txt}>🚩</text>}
                  <circle cx="80" cy={b.y + b.h - 8} r="4.5" fill="none" stroke={txt} strokeWidth="1.6" opacity=".9" />
                </g>
              )
            })}
          </g>

          {/* bottom nav */}
          <g transform="translate(0,634)">
            <rect x="14" y="0" width="312" height="20" fill="#fff" />
            <line x1="14" y1="0" x2="326" y2="0" stroke="#E8E7F2" />
            <text x="252" y="14" fill="#6D5EF6" fontSize="9.5" fontWeight="700" textAnchor="middle" fontFamily="Heebo, sans-serif">יומן</text>
            <text x="88" y="14" fill="#94A3B8" fontSize="9.5" fontWeight="700" textAnchor="middle" fontFamily="Heebo, sans-serif">משימות</text>
          </g>
          {/* FAB */}
          <g transform="translate(154,608)">
            <circle cx="16" cy="16" r="18" fill="url(#hdr)" opacity=".3" />
            <circle cx="16" cy="16" r="15" fill="url(#hdr)" />
            <path d="M16 9v14M9 16h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </div>
  )
}

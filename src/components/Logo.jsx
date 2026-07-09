export default function Logo({ size = 36 }) {
  return (
    <div className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366F1" />
            <stop offset=".5" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#D946EF" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#lg)" />
        <rect x="16" y="18" width="32" height="30" rx="6" fill="#fff" opacity=".95" />
        <rect x="16" y="18" width="32" height="8" rx="6" fill="#1B1930" opacity=".18" />
        <rect x="21" y="30" width="14" height="4" rx="2" fill="#8B5CF6" />
        <rect x="21" y="37" width="22" height="4" rx="2" fill="#D946EF" opacity=".65" />
      </svg>
      <span className="font-extrabold tracking-tight text-[color:var(--color-ink)]" style={{ fontSize: size * 0.55 }}>DaySpace</span>
    </div>
  )
}

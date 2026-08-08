const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ size = 22, children, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...base} {...rest}>
      {children}
    </svg>
  )
}

export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Svg>
)

export const IconClose = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const IconLocate = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.4" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    <circle cx="12" cy="12" r="8" opacity=".55" />
  </Svg>
)

export const IconLayers = (p) => (
  <Svg {...p}>
    <path d="M12 3.5 3 8l9 4.5L21 8z" />
    <path d="m3 13 9 4.5L21 13" />
    <path d="m3 17.5 9 4.5 9-4.5" opacity=".5" />
  </Svg>
)

export const IconUsers = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.8 19.4a6.4 6.4 0 0 1 12.4 0" />
    <path d="M16.2 5.2a3.4 3.4 0 0 1 0 6.6M17.6 14.3a6.4 6.4 0 0 1 3.6 5.1" opacity=".6" />
  </Svg>
)

export const IconPin = (p) => (
  <Svg {...p}>
    <path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
    <circle cx="12" cy="10.4" r="2.6" />
  </Svg>
)

export const IconBell = (p) => (
  <Svg {...p}>
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z" />
    <path d="M13.7 20a2 2 0 0 1-3.4 0" />
  </Svg>
)

export const IconSettings = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.5 14.2a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V22a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06A2 2 0 1 1 4.54 18l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06A2 2 0 1 1 6.02 5.5l.06.06a1.6 1.6 0 0 0 1.77.32H8a1.6 1.6 0 0 0 .97-1.47V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06A2 2 0 1 1 18.6 8.02l-.06.06a1.6 1.6 0 0 0-.32 1.77V10a1.6 1.6 0 0 0 1.47.97H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.47.97Z" />
  </Svg>
)

export const IconShare = (p) => (
  <Svg {...p}>
    <circle cx="17.5" cy="5.5" r="2.6" />
    <circle cx="6.5" cy="12" r="2.6" />
    <circle cx="17.5" cy="18.5" r="2.6" />
    <path d="m8.9 10.7 6.3-3.6M8.9 13.3l6.3 3.6" />
  </Svg>
)

export const IconRoute = (p) => (
  <Svg {...p}>
    <circle cx="5.5" cy="18.5" r="2.4" />
    <circle cx="18.5" cy="5.5" r="2.4" />
    <path d="M8 18.5h5.2a4.3 4.3 0 0 0 0-8.6H10a4.3 4.3 0 0 1 0-8.6" opacity=".9" />
  </Svg>
)

export const IconChevron = (p) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
)

export const IconChevronDown = (p) => (
  <Svg {...p}>
    <path d="m5 9 7 7 7-7" />
  </Svg>
)

export const IconPlus = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconTrash = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M6.5 7 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7" />
  </Svg>
)

export const IconBattery = ({ level = 1, charging = false, size = 22, ...rest }) => {
  const width = Math.max(1.5, Math.min(13, 13 * (level ?? 0)))
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...base} {...rest}>
      <rect x="2.5" y="7.5" width="16" height="9" rx="2.6" />
      <path d="M21 10.5v3" />
      <rect x="4.5" y="9.5" width={width} height="5" rx="1.4" fill="currentColor" stroke="none" />
      {charging && (
        <path d="M12.4 8.6 9.8 12.4h2.4l-.6 3 2.8-4h-2.4z" fill="#0B1020" stroke="none" />
      )}
    </svg>
  )
}

export const IconGhost = (p) => (
  <Svg {...p}>
    <path d="M5 20V10a7 7 0 0 1 14 0v10l-2.3-1.8L14.4 20l-2.4-1.8L9.6 20 7.3 18.2z" />
    <path d="M9.5 10h.01M14.5 10h.01" strokeWidth="2.6" />
  </Svg>
)

export const IconSos = (p) => (
  <Svg {...p}>
    <path d="M12 3.2 2.6 19.4a1.2 1.2 0 0 0 1.05 1.8h16.7a1.2 1.2 0 0 0 1.05-1.8Z" />
    <path d="M12 9.5v4.2M12 17.2h.01" strokeWidth="2.4" />
  </Svg>
)

export const IconHistory = (p) => (
  <Svg {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3.2 4.6v4.2h4.2" />
    <path d="M12 7.8V12l3 1.8" />
  </Svg>
)

export const IconCopy = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.6" />
    <path d="M15 6.2A2.2 2.2 0 0 0 12.8 4H6.2A2.2 2.2 0 0 0 4 6.2v6.6A2.2 2.2 0 0 0 6.2 15" />
  </Svg>
)

export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.6 4.5L19 7" />
  </Svg>
)

export const IconCompass = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.4 8.6-2 5.4-5.4 2 2-5.4z" />
  </Svg>
)

export const IconWalk = (p) => (
  <Svg {...p}>
    <circle cx="13" cy="4.2" r="1.8" />
    <path d="m9 21 2.4-5.2-1.9-2.6.7-4.4 3.3 1.3 1.4 2.9 2.6.9" />
    <path d="m11.5 15.8 2.6 2.1.9 3.1M10.2 8.8 7 10.4l-.8 3" />
  </Svg>
)

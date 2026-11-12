const PATHS = {
  dashboard: (
    <>
      <rect x="3" y="4" width="18" height="12.5" rx="2.2" />
      <path d="M9 20.5h6M12 16.5v4" />
      <path d="M6.4 13.2l2.6-2.9 2 1.7 2.3-3.2" />
      <circle cx="16.9" cy="9.3" r="1.9" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 7.2c0-1 .8-1.7 1.7-1.7h4.1l2 2.2h7.5c1 0 1.7.8 1.7 1.7v8.4c0 1-.8 1.7-1.7 1.7H5.2c-1 0-1.7-.8-1.7-1.7z" />
      <path d="M3.5 10.4h17" />
    </>
  ),
  token: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6.3" strokeWidth="1.3" />
      <text x="12" y="14.25" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Montserrat, sans-serif">
        RE
      </text>
    </>
  ),
  briefcase: (
    <>
      <rect x="3.5" y="7" width="17" height="12.5" rx="2" />
      <path d="M8.8 7V5.6c0-.9.7-1.6 1.6-1.6h3.2c.9 0 1.6.7 1.6 1.6V7" />
      <path d="M3.5 12.2h17" />
      <path d="M10.5 12.2v1.8h3v-1.8" />
    </>
  ),
  bulb: (
    <>
      <path d="M9.2 17.4h5.6M10 20.5h4" />
      <path d="M12 3.5a5.8 5.8 0 0 0-3.5 10.4c.5.4.8 1 .8 1.6v1.9h5.4v-1.9c0-.6.3-1.2.8-1.6A5.8 5.8 0 0 0 12 3.5z" />
    </>
  ),
  tasks: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.2" />
      <path d="M7.4 9l1.5 1.5 2.5-3M13.6 9h3.2M7.4 15.3l1.5 1.5 2.5-3M13.6 15.3h3.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.3" />
      <path d="M3.2 19.5c.4-3.2 2.9-5.3 5.8-5.3s5.4 2.1 5.8 5.3" />
      <path d="M15.6 5.4a3.2 3.2 0 0 1 0 6.2M17.6 14.6c1.8.7 3 2.5 3.2 4.9" />
    </>
  ),
  report: (
    <>
      <path d="M14 3.5H7.2c-1 0-1.7.8-1.7 1.7v13.6c0 1 .8 1.7 1.7 1.7h9.6c1 0 1.7-.8 1.7-1.7V8z" />
      <path d="M14 3.5V8h4.5M9 17v-2.5M12 17v-5M15 17v-3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6.2 16.5v-5.2a5.8 5.8 0 0 1 11.6 0v5.2l1.4 1.8H4.8z" />
      <path d="M10 20.3a2.1 2.1 0 0 0 4 0" />
    </>
  ),
  sliders: <path d="M6 4v5.5M6 13.5V20M12 4v1.5M12 9.5V20M18 4v9M18 17v3M4 11.5h4M10 7.5h4M16 15h4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.6" />
      <path d="M16 16l4 4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M6 12h12" />,
  chevronDown: <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />,
  chevronLeft: <path d="M14.5 6.5L9 12l5.5 5.5" />,
  dots: (
    <>
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  share: (
    <>
      <path d="M8 10.5H7c-1 0-1.7.8-1.7 1.7v6.3c0 1 .8 1.7 1.7 1.7h10c1 0 1.7-.8 1.7-1.7v-6.3c0-1-.8-1.7-1.7-1.7h-1" />
      <path d="M12 14V3.8M8.8 6.8L12 3.6l3.2 3.2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
    </>
  ),
  sort: (
    <>
      <path d="M4 6.5h11M4 12h8M4 17.5h5" />
      <circle cx="18.5" cy="6.5" r="1.6" />
    </>
  ),
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  logout: (
    <>
      <path d="M14 4.5h3.8c1 0 1.7.8 1.7 1.7v11.6c0 1-.8 1.7-1.7 1.7H14" />
      <path d="M10 8l-4 4 4 4M6 12h9.5" />
    </>
  ),
  download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4.5 19.5h15" />,
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4.2h-4.2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12s3.4-6.5 9.2-6.5 9.2 6.5 9.2 6.5-3.4 6.5-9.2 6.5S2.8 12 2.8 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  file: (
    <>
      <path d="M14 3.5H7.2c-1 0-1.7.8-1.7 1.7v13.6c0 1 .8 1.7 1.7 1.7h9.6c1 0 1.7-.8 1.7-1.7V8z" />
      <path d="M14 3.5V8h4.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  arrowUp: <path d="M7 17L17 7M9 7h8v8" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5 20c.6-3.6 3.5-6 7-6s6.4 2.4 7 6" />
    </>
  ),
  contacts: (
    <>
      <rect x="4" y="3.5" width="15.5" height="17" rx="2.6" />
      <circle cx="11.8" cy="10" r="2.6" />
      <path d="M7.6 16.6c.6-2 2.2-3.1 4.2-3.1s3.6 1.1 4.2 3.1M2.5 8h2.4M2.5 12h2.4M2.5 16h2.4" />
    </>
  ),
  kanban: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M8.5 7.5v6M12 7.5v9M15.5 7.5v3.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.8v5.1c0 4.4-2.9 7.9-7 9.1-4.1-1.2-7-4.7-7-9.1V6.3z" />
      <path d="M9.2 12.1l2 2 3.8-4" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.4" />
      <path d="M4.5 7l7.5 5.6L19.5 7" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.6" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3M8 14h2M14 14h2M8 17h2" />
    </>
  ),
  trendUp: <path d="M4 16.5l5-5 3.5 3.5L20 7.5M15 7.5h5v5" />,
  trendDown: <path d="M4 7.5l5 5 3.5-3.5 7.5 7.5M15 16.5h5v-5" />,
  userPlus: (
    <>
      <circle cx="10" cy="8.5" r="3.4" />
      <path d="M3.8 19.5c.5-3.3 3-5.4 6.2-5.4 1.4 0 2.6.4 3.6 1.1M18 13v6M15 16h6" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.9 12.1L19 4M15.5 7.5l2.5 2.5M17.5 5.5L20 8" />
    </>
  ),
  phone: <path d="M6.6 3.8h2.6l1.4 4.1-2 1.4a11 11 0 0 0 6.1 6.1l1.4-2 4.1 1.4v2.6c0 1-.8 1.8-1.8 1.8A15.8 15.8 0 0 1 4.8 5.6c0-1 .8-1.8 1.8-1.8z" />,
  send: <path d="M20.5 3.5L10 14M20.5 3.5l-6.6 17-3.9-6.5-6.5-3.9z" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7" />
      <path d="M6.5 7l.9 11.6c.1 1 .9 1.9 1.9 1.9h5.4c1 0 1.8-.8 1.9-1.9L17.5 7M10.2 11v5.5M13.8 11v5.5" />
    </>
  ),
  edit: (
    <>
      <path d="M14.5 5.5l4 4L9 19H5v-4z" />
      <path d="M12.5 7.5l4 4" />
    </>
  ),
  dotsH: (
    <>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  filter: <path d="M4 5.5h16l-6.2 7.3v5.4l-3.6 1.8v-7.2z" />,
  upload: <path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9M4.5 19.5h15" />,
  chevronRight: <path d="M9.5 6.5L15 12l-5.5 5.5" />,
  arrowRight: <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  building: (
    <>
      <rect x="4.5" y="3.5" width="10" height="17" rx="1.6" />
      <path d="M14.5 9.5h3.4c.9 0 1.6.7 1.6 1.6v9.4M8 7.5h3M8 11h3M8 14.5h3M2.5 20.5h19" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4.8c0-.7.6-1.3 1.3-1.3h7.4l8.3 8.3c.5.5.5 1.3 0 1.8l-7.2 7.2c-.5.5-1.3.5-1.8 0z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  bars: <path d="M5 20V12M10 20V6M15 20v-9M20 20V4" />,
  line: <path d="M3.5 17.5l5-6 4 3.5 7.5-9" />,
  pie: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z" />
      <path d="M15 3.9A8.5 8.5 0 0 1 20.1 9H15z" />
    </>
  ),
  zap: <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />,
  layers: (
    <>
      <path d="M12 4l8.5 4.5L12 13 3.5 8.5z" />
      <path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5" />
    </>
  ),
  star: <path d="M12 3.8l2.5 5.2 5.6.8-4.1 3.9 1 5.6L12 16.6l-5 2.7 1-5.6-4.1-3.9 5.6-.8z" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.2" />
      <path d="M15.5 8.5V6.2c0-1.2-1-2.2-2.2-2.2H6.2C5 4 4 5 4 6.2v7.1c0 1.2 1 2.2 2.2 2.2h2.3" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.5 13.5l2.7-7.6c.3-.8 1-1.4 1.9-1.4h7.8c.9 0 1.6.6 1.9 1.4l2.7 7.6v4.8c0 1.2-1 2.2-2.2 2.2H5.7c-1.2 0-2.2-1-2.2-2.2z" />
      <path d="M3.5 13.5h4.6l1.4 2.4h5l1.4-2.4h4.6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5S9.6 5.8 12 3.5z" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </>
  ),
  smartphone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.4" />
      <path d="M11 17.5h2" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  sparkle: <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.6 7.6 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.4z" />
    </>
  ),
  /* ---- added for Ice Diamonds (same 24px grid, 1.7 stroke) ---- */
  coins: (
    <>
      <ellipse cx="9.5" cy="7.5" rx="5.5" ry="2.6" />
      <path d="M4 7.5v4c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4" />
      <path d="M9 16.8c.4 1.3 2.7 2.3 5.5 2.3 3 0 5.5-1.2 5.5-2.6v-4c0-1.2-1.7-2.2-4.1-2.5" />
    </>
  ),
  truck: (
    <>
      <path d="M2.8 6.5h11v9.5h-11z" />
      <path d="M13.8 9.5h4l3.2 3.3V16h-7.2" />
      <circle cx="7" cy="17.3" r="1.8" />
      <circle cx="17.3" cy="17.3" r="1.8" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.2c0-1 .8-1.7 1.7-1.7h11.6v3" />
      <rect x="4" y="8.5" width="16.5" height="11" rx="2.2" />
      <path d="M15.6 14h2.4" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.4" />
      <path d="M3 9.8h18M6.8 15h3.4" />
    </>
  ),
  bank: (
    <>
      <path d="M3.5 9.2L12 4.5l8.5 4.7z" />
      <path d="M5.5 10.5v6.5M9.8 10.5v6.5M14.2 10.5v6.5M18.5 10.5v6.5M3.5 19.5h17" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
    </>
  ),
}

export default function Icon({ name, className = '', ...rest }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}

/** The ring mark: teal, green and a light segment, matching the reference. */
export function Logo({ className = '', light = '#ffffff' }) {
  const C = 2 * Math.PI * 13
  const seg = (from, to) => ({
    strokeDasharray: `${((to - from) / 360) * C} ${C}`,
    strokeDashoffset: -(from / 360) * C,
  })
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <g transform="rotate(-90 20 20)" fill="none" strokeWidth="7.5">
        <circle cx="20" cy="20" r="13" stroke="#2b6a80" {...seg(160, 352)} />
        <circle cx="20" cy="20" r="13" stroke="#a9e394" {...seg(62, 150)} />
        <circle cx="20" cy="20" r="13" stroke={light} {...seg(4, 52)} />
      </g>
    </svg>
  )
}

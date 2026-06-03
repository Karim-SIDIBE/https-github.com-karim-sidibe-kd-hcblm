// Minimal inline icons (stroke = currentColor) for the nav + chrome.
type P = { size?: number };
const s = (size = 22) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const IconHome = ({ size }: P) => (<svg {...s(size)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></svg>);
export const IconBook = ({ size }: P) => (<svg {...s(size)}><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" /><path d="M8 7h7M8 11h7" /></svg>);
export const IconJournal = ({ size }: P) => (<svg {...s(size)}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v18M12 8h4M12 12h4" /></svg>);
export const IconBadge = ({ size }: P) => (<svg {...s(size)}><circle cx="12" cy="9" r="6" /><path d="M8.5 14 7 22l5-3 5 3-1.5-8" /></svg>);
export const IconBell = ({ size }: P) => (<svg {...s(size)}><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10.5 20a1.8 1.8 0 0 0 3 0" /></svg>);

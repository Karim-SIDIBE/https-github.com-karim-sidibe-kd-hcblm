/** Inline stroke icons (Feather-style), sized by CSS. */
const S = (p: { d: string; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={p.fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {p.d.split("|").map((d, i) => <path key={i} d={d} />)}
  </svg>
);
export const IDash = () => <S d="M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z" />;
export const ILearners = () => <S d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75" />;
export const IEnrol = () => <S d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M11 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0|M19 8v6|M22 11h-6" />;
export const IReeng = () => <S d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 0 1-3.46 0" />;
export const ICourse = () => <S d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />;
export const IEval = () => <S d="M9 11l3 3L22 4|M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />;
export const ICert = () => <S d="M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z|M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />;
export const IOrg = () => <S d="M3 21h18|M5 21V7l8-4v18|M19 21V11l-6-4|M9 9v.01|M9 12v.01|M9 15v.01|M9 18v.01" />;
export const ISession = () => <S d="M23 7l-7 5 7 5V7z|M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />;
export const IAudit = () => <S d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
export const ISettings = () => <S d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />;
export const ISearch = () => <S d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|M21 21l-4.35-4.35" />;
export const IUsersK = () => <S d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />;
export const IPulse = () => <S d="M22 12h-4l-3 9L9 3l-3 9H2" />;
export const ITrophy = () => <S d="M8 21h8|M12 17v4|M7 4h10v5a5 5 0 0 1-10 0V4z|M7 4H4v2a3 3 0 0 0 3 3|M17 4h3v2a3 3 0 0 1-3 3" />;
export const ITarget = () => <S d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z|M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />;
export const IClock = () => <S d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 6v6l4 2" />;

// hf-kit.jsx — Hi-fi Declick components (frames + DS atoms). Exports to window.

const HIco = {
  bell: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>),
  user: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>),
  users: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="8" r="3.4"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M21 20a6 6 0 0 0-4-5.7"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 13l4 4L19 6"/></svg>),
  lock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>),
  clock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  arrow: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>),
  home: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/></svg>),
  book: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>),
  journal: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>),
  award: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="9" r="5"/><path d="M9 13.5L8 21l4-2 4 2-1-7.5"/></svg>),
  chevron: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 6l6 6-6 6"/></svg>),
  cc: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 11h2M14 11h2M8 14h5"/></svg>),
  download: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/></svg>),
  linkedin: (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95C20.5 8.75 22 11 22 14.5V21h-4v-5.7c0-1.36-.02-3.1-1.9-3.1-1.9 0-2.2 1.48-2.2 3v5.8H9z"/></svg>),
};

function HPhone({ children, tab, time = "9:41" }) {
  return (
    <div className="hf-phone">
      <div className="hf-phone__notch" />
      <div className="hf-phone__status"><span>{time}</span><span className="dots">Declick</span></div>
      <div className="hf-phone__scroll">
        <div className="hf-phone__body" style={{ paddingBottom: tab ? 84 : 16 }}>{children}</div>
        {tab && <HTabBar active={tab} />}
      </div>
    </div>
  );
}
function HTabBar({ active = "home" }) {
  const tabs = [["home", "Accueil", HIco.home], ["book", "Cours", HIco.book], ["journal", "Journal", HIco.journal], ["award", "Badges", HIco.award]];
  return (
    <div className="hf-tabbar">
      {tabs.map(([id, lbl, Ic]) => <div key={id} className={"hf-tab" + (id === active ? " on" : "")}><Ic />{lbl}</div>)}
    </div>
  );
}
function HWin({ url = "app.declick.kompetences.net", children }) {
  return (
    <div className="hf-win">
      <div className="hf-win__bar"><i /><i /><i /><div className="hf-win__url">{url}</div><div style={{ width: 44 }} /></div>
      {children}
    </div>
  );
}
function HLogo({ sub = true }) {
  return (
    <div className="hf-logo">
      <img src="assets/logo-declick.png" alt="" />
      <div className="wm">KOMPETENCES <b>DECLICK</b>{sub && <span className="sub">DECLICK DIGITAL</span>}</div>
    </div>
  );
}
function HBtn({ children, kind = "primary", sm, block, arrow, disabled }) {
  const cls = ["hf-btn", kind && "hf-btn--" + kind, sm && "hf-btn--sm", block && "hf-btn--block", disabled && "hf-btn--disabled"].filter(Boolean).join(" ");
  return <span className={cls}>{children}{arrow && <HIco.arrow style={{ width: 16, height: 16 }} />}</span>;
}
function HPill({ children, kind, sm, dot }) {
  return <span className={"hf-pill" + (kind ? " hf-pill--" + kind : "") + (sm ? " hf-pill--sm" : "")}>{dot && <span className="dot" />}{children}</span>;
}
function HMember() { return <span className="hf-pill"><span className="dot" />Membre de KOMPETENCES AFRICA</span>; }

function HMedia({ h = 180, radius, scrub = 38, chips = ["ST", "1×"], quality = "Auto 480p" }) {
  return (
    <div className="hf-media" style={{ height: h, borderRadius: radius }}>
      <div className="play" />
      {quality && <div className="topchip"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brand-declick)" }} />{quality}</div>}
      <div className="chips">{chips.map((c, i) => <span key={i} className="chip">{c}</span>)}</div>
      <div className="scrub"><i style={{ width: scrub + "%" }} /></div>
    </div>
  );
}
function HProg({ pct = 40, mint }) { return <div className={"hf-prog" + (mint ? " mint" : "")}><i style={{ width: pct + "%" }} /></div>; }

function HRing({ pct = 64, size = 56, label, color = "var(--brand-declick)" }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  return (
    <div className="hf-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--navy-50)" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div style={{ position: "absolute", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: size * 0.3, color: "var(--navy-600)" }}>{label != null ? label : pct}</div>
    </div>
  );
}
function HRail({ state = ["done", "now", "lock", "lock", "lock"] }) {
  return (
    <div className="hf-rail">
      {state.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className={"seg" + (state[i - 1] === "done" ? " done" : "")} />}
          <span className={"node " + (s === "todo" ? "" : s)}>{s === "done" ? <HIco.check style={{ width: 16, height: 16 }} /> : (s === "lock" ? <HIco.lock style={{ width: 14, height: 14 }} /> : i)}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
function HMedal({ kind, label, lg }) { return <div className={"hf-medal" + (kind ? " " + kind : "") + (lg ? " lg" : "")}>{label}</div>; }

// PAM block; pass children with <em> for the highlighted anchor phrase
function HPam({ children, label = "Moment d'Ancrage" }) {
  return (
    <div className="hf-pam">
      <div className="tag"><HIco.award style={{ width: 12, height: 12 }} />{label}</div>
      <div className="quote">{children}</div>
    </div>
  );
}

function HNote({ n, t }) { return (<div className="hf-note"><span className="hf-note__n">{n}</span><div className="hf-note__t">{t}</div></div>); }
function HAnnotated({ children, title = "Design system appliqué", notes = [] }) {
  return (
    <div className="hf">
      {children}
      <div className="hf-notes">
        <div className="hf-notes__h">{title}</div>
        {notes.map((x, i) => <HNote key={i} n={i + 1} t={x} />)}
      </div>
    </div>
  );
}

Object.assign(window, { HIco, HPhone, HTabBar, HWin, HLogo, HBtn, HPill, HMember, HMedia, HProg, HRing, HRail, HMedal, HPam, HNote, HAnnotated });

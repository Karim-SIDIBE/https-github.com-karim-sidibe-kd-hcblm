// wf-kit.jsx — shared wireframe primitives for the KD-HCBLM canvas.
// Clean low-fi atoms + phone/desktop frames + annotation system.
// Exports everything to window for the section files.

// ---- tiny inline icons (stroke, wireframe weight) ----
const Ico = {
  lock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>),
  play: (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M7 5l12 7-12 7z"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 13l4 4L19 6"/></svg>),
  clock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  bolt: (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>),
  bell: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>),
  user: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>),
  arrow: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>),
};

// ---- placeholder text bars ----
function Bars({ n = 3, w, gap = 6, cls = "" }) {
  return (
    <div className="wf-lines" style={{ gap, width: w }}>
      {Array.from({ length: n }).map((_, i) => <div key={i} className={"wf-bar " + cls} />)}
    </div>
  );
}

// ---- phone frame ----
function Phone({ title = "declick.kompetences.net", children, tab, time = "9:41" }) {
  return (
    <div className="wf-phone">
      <div className="wf-phone__notch" />
      <div className="wf-phone__status">
        <span>{time}</span>
        <span>▮▮▮ ◵ 4G</span>
      </div>
      <div className="wf-phone__body">{children}</div>
      {tab && <TabBar active={tab} />}
    </div>
  );
}
function TabBar({ active = 0 }) {
  return (
    <div className="wf-phone__tabbar">
      {[0, 1, 2, 3].map((i) => <div key={i} className={"wf-tabicon" + (i === active ? " is-on" : "")} />)}
    </div>
  );
}

// ---- desktop browser frame ----
function Win({ url = "app.declick.kompetences.net", children }) {
  return (
    <div className="wf-win">
      <div className="wf-win__bar">
        <div className="wf-win__dots"><i /><i /><i /></div>
        <div className="wf-win__url">{url}</div>
        <div style={{ width: 40 }} />
      </div>
      <div className="wf-win__body">{children}</div>
    </div>
  );
}

// ---- app logo lockup ----
function Logo({ small }) {
  return (
    <div className="wf-logo" style={small ? { fontSize: 11 } : null}>
      <span className="wf-logo__mk" />
      KOMPETENCES <b>DECLICK</b>
    </div>
  );
}

// ---- buttons ----
function Btn({ children, kind, sm, block, disabled, arrow }) {
  const cls = ["wf-btn",
    kind === "primary" && "wf-btn--primary",
    kind === "go" && "wf-btn--go",
    kind === "ghost" && "wf-btn--ghost",
    sm && "wf-btn--sm", block && "block", disabled && "is-disabled"].filter(Boolean).join(" ");
  return <span className={cls}>{children}{arrow && <Ico.arrow style={{ width: 14, height: 14 }} />}</span>;
}

// ---- chips / pills ----
function Chip({ children, dot, member }) {
  return <span className={"wf-chip" + (member ? " member" : "")}>{dot && <span className="dot" />}{children}</span>;
}
function Member() { return <span className="wf-chip member"><span className="dot" />Membre de KOMPETENCES AFRICA</span>; }

// ---- media placeholder ----
function Media({ h = 120, play, label, radius }) {
  return (
    <div className="wf-img cross" style={{ height: h, borderRadius: radius }}>
      {play && <div className="wf-img__play" />}
      {label && <span className="wf-img__lab wf-meta">{label}</span>}
    </div>
  );
}

// ---- progress bar ----
function Prog({ pct = 40, orange }) {
  return <div className={"wf-prog" + (orange ? " o" : "")}><i style={{ width: pct + "%" }} /></div>;
}

// ---- block rail (0..4) ----
function Rail({ state = ["done", "now", "lock", "lock", "lock"], compact }) {
  // state[i] in done|now|lock|todo
  return (
    <div className="wf-rail">
      {state.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className={"seg" + (state[i - 1] === "done" ? " done" : "")} />}
          <span className={"node " + (s === "todo" ? "" : s)}>
            {s === "done" ? <Ico.check style={{ width: 12, height: 12 }} /> : (s === "lock" ? <Ico.lock style={{ width: 11, height: 11 }} /> : i)}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---- lock pill ----
function LockTag({ children }) { return <span className="wf-lock"><Ico.lock />{children}</span>; }

// ---- badge medallion ----
function Medal({ kind, label }) {
  return <div className={"wf-medal" + (kind ? " " + kind : "")}>{label}</div>;
}

// ---- PAM inline highlight ----
function PAM({ children = "« …11 h au bureau, et mon dossier prioritaire n'a pas avancé… »", tag }) {
  return <span className="pam">{tag && <span className="pam-tag">PAM</span>} {children}</span>;
}
function PamTag() { return <span className="pam-tag">PAM</span>; }

// =========================================================
//  Annotation system
//  <Annotated frame={<Phone/>} notes={[{n,lvl,ref,text}]} />
//  - renders the device frame + a right-hand notes column
//  - inline <Pin n={1}/> markers sit on the UI; numbers match notes
// =========================================================
const LVL = {
  non:  "Non-négociable",
  crit: "Critique",
  req:  "Requis",
  fail: "Échec critique",
};
function Pin({ n, style }) {
  return <span className={"wf-pin" + (style ? " abs" : "")} style={style}>{n}</span>;
}
function Note({ n, lvl, cite, text }) {
  return (
    <div className="wf-note">
      <span className="wf-note__n">{n}</span>
      <div className="wf-note__body">
        {lvl && <span className={"wf-lvl " + lvl}>{LVL[lvl]}{cite && <span className="ref"> · {cite}</span>}</span>}
        <div className="wf-note__txt">{text}</div>
      </div>
    </div>
  );
}
function Annotated({ children, notes = [], notesTitle = "Ce que ça résout" }) {
  return (
    <div className="wf" style={{ alignItems: "flex-start" }}>
      {children}
      <div className="wf-notes">
        <div className="wf-notes__h">{notesTitle}</div>
        {notes.map((nt) => <Note key={nt.n} {...nt} />)}
      </div>
    </div>
  );
}

Object.assign(window, {
  Ico, Bars, Phone, TabBar, Win, Logo, Btn, Chip, Member, Media, Prog, Rail,
  LockTag, Medal, PAM, PamTag, Pin, Note, Annotated, LVL,
});

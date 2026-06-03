function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Combined hf-kit + prototype-app for Babel compilation

// hf-kit.jsx — Hi-fi Declick components (frames + DS atoms). Exports to window.

const HIco = {
  bell: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 20a2 2 0 0 0 4 0"
  })),
  user: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 21a8 8 0 0 1 16 0"
  })),
  users: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "8",
    r: "3.4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 20a6 6 0 0 1 12 0"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 5.2a3.4 3.4 0 0 1 0 6.6M21 20a6 6 0 0 0-4-5.7"
  })),
  check: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M5 13l4 4L19 6"
  })),
  lock: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "11",
    width: "14",
    height: "9",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 11V8a4 4 0 0 1 8 0v3"
  })),
  clock: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7v5l3 2"
  })),
  arrow: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14M13 6l6 6-6 6"
  })),
  home: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M4 11l8-7 8 7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 10v9h12v-9"
  })),
  book: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 17a3 3 0 0 1 3-3h11"
  })),
  journal: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "3",
    width: "14",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 7h6M9 11h6M9 15h4"
  })),
  award: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "9",
    r: "5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 13.5L8 21l4-2 4 2-1-7.5"
  })),
  chevron: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M9 6l6 6-6 6"
  })),
  cc: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "14",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 11h2M14 11h2M8 14h5"
  })),
  download: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"
  })),
  linkedin: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95C20.5 8.75 22 11 22 14.5V21h-4v-5.7c0-1.36-.02-3.1-1.9-3.1-1.9 0-2.2 1.48-2.2 3v5.8H9z"
  }))
};
function HPhone({
  children,
  tab,
  time = "9:41"
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-phone"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hf-phone__notch"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hf-phone__status"
  }, /*#__PURE__*/React.createElement("span", null, time), /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, "Declick")), /*#__PURE__*/React.createElement("div", {
    className: "hf-phone__scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hf-phone__body",
    style: {
      paddingBottom: tab ? 84 : 16
    }
  }, children), tab && /*#__PURE__*/React.createElement(HTabBar, {
    active: tab
  })));
}
function HTabBar({
  active = "home"
}) {
  const tabs = [["home", "Accueil", HIco.home], ["book", "Cours", HIco.book], ["journal", "Journal", HIco.journal], ["award", "Badges", HIco.award]];
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-tabbar"
  }, tabs.map(([id, lbl, Ic]) => /*#__PURE__*/React.createElement("div", {
    key: id,
    className: "hf-tab" + (id === active ? " on" : "")
  }, /*#__PURE__*/React.createElement(Ic, null), lbl)));
}
function HWin({
  url = "app.declick.kompetences.net",
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-win"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hf-win__bar"
  }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("div", {
    className: "hf-win__url"
  }, url), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44
    }
  })), children);
}
function HLogo({
  sub = true
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-logo"
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/logo-declick.png",
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    className: "wm"
  }, "KOMPETENCES ", /*#__PURE__*/React.createElement("b", null, "DECLICK"), sub && /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, "DECLICK DIGITAL")));
}
function HBtn({
  children,
  kind = "primary",
  sm,
  block,
  arrow,
  disabled
}) {
  const cls = ["hf-btn", kind && "hf-btn--" + kind, sm && "hf-btn--sm", block && "hf-btn--block", disabled && "hf-btn--disabled"].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", {
    className: cls
  }, children, arrow && /*#__PURE__*/React.createElement(HIco.arrow, {
    style: {
      width: 16,
      height: 16
    }
  }));
}
function HPill({
  children,
  kind,
  sm,
  dot
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "hf-pill" + (kind ? " hf-pill--" + kind : "") + (sm ? " hf-pill--sm" : "")
  }, dot && /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), children);
}
function HMember() {
  return /*#__PURE__*/React.createElement("span", {
    className: "hf-pill"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "Membre de KOMPETENCES AFRICA");
}
function HMedia({
  h = 180,
  radius,
  scrub = 38,
  chips = ["ST", "1×"],
  quality = "Auto 480p"
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-media",
    style: {
      height: h,
      borderRadius: radius
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "play"
  }), quality && /*#__PURE__*/React.createElement("div", {
    className: "topchip"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "var(--brand-declick)"
    }
  }), quality), /*#__PURE__*/React.createElement("div", {
    className: "chips"
  }, chips.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "chip"
  }, c))), /*#__PURE__*/React.createElement("div", {
    className: "scrub"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: scrub + "%"
    }
  })));
}
function HProg({
  pct = 40,
  mint
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-prog" + (mint ? " mint" : "")
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: pct + "%"
    }
  }));
}
function HRing({
  pct = 64,
  size = 56,
  label,
  color = "var(--brand-declick)"
}) {
  const r = (size - 8) / 2,
    c = 2 * Math.PI * r;
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-ring",
    style: {
      width: size,
      height: size
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--navy-50)",
    strokeWidth: "6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: color,
    strokeWidth: "6",
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c * (1 - pct / 100)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: size * 0.3,
      color: "var(--navy-600)"
    }
  }, label != null ? label : pct));
}
function HRail({
  state = ["done", "now", "lock", "lock", "lock"]
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-rail"
  }, state.map((s, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "seg" + (state[i - 1] === "done" ? " done" : "")
  }), /*#__PURE__*/React.createElement("span", {
    className: "node " + (s === "todo" ? "" : s)
  }, s === "done" ? /*#__PURE__*/React.createElement(HIco.check, {
    style: {
      width: 16,
      height: 16
    }
  }) : s === "lock" ? /*#__PURE__*/React.createElement(HIco.lock, {
    style: {
      width: 14,
      height: 14
    }
  }) : i))));
}
function HMedal({
  kind,
  label,
  lg
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-medal" + (kind ? " " + kind : "") + (lg ? " lg" : "")
  }, label);
}

// PAM block; pass children with <em> for the highlighted anchor phrase
function HPam({
  children,
  label = "Moment d'Ancrage"
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-pam"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tag"
  }, /*#__PURE__*/React.createElement(HIco.award, {
    style: {
      width: 12,
      height: 12
    }
  }), label), /*#__PURE__*/React.createElement("div", {
    className: "quote"
  }, children));
}
function HNote({
  n,
  t
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-note"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hf-note__n"
  }, n), /*#__PURE__*/React.createElement("div", {
    className: "hf-note__t"
  }, t));
}
function HAnnotated({
  children,
  title = "Design system appliqué",
  notes = []
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hf"
  }, children, /*#__PURE__*/React.createElement("div", {
    className: "hf-notes"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hf-notes__h"
  }, title), notes.map((x, i) => /*#__PURE__*/React.createElement(HNote, {
    key: i,
    n: i + 1,
    t: x
  }))));
}
Object.assign(window, {
  HIco,
  HPhone,
  HTabBar,
  HWin,
  HLogo,
  HBtn,
  HPill,
  HMember,
  HMedia,
  HProg,
  HRing,
  HRail,
  HMedal,
  HPam,
  HNote,
  HAnnotated
});

// prototype-app.jsx — Clickable mobile prototype of the Declick learner journey.
// Reuses hf-kit components; adds real state: navigation, active video, exercise, journal.
const {
  useState,
  useEffect,
  useRef
} = React;

/* interactive video player */
function PtVideo({
  playing,
  done,
  onPlay
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-media" + (playing ? " is-playing" : ""),
    style: {
      height: 184,
      borderRadius: "var(--r-lg)"
    },
    onClick: !playing && !done ? onPlay : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "play"
  }), /*#__PURE__*/React.createElement("div", {
    className: "topchip"
  }, playing ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "hf-livedot"
  }), "Lecture \xB7 03:48") : done ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "var(--brand-declick)"
    }
  }), "Termin\xE9e") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "var(--brand-declick)"
    }
  }), "Auto 480p")), /*#__PURE__*/React.createElement("div", {
    className: "chips"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, "ST"), /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, "1\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "scrub"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: (done ? 100 : playing ? 100 : 38) + "%",
      transition: playing ? "width 3.4s linear" : "width .25s"
    }
  })));
}
function PtTabs({
  active,
  onTab
}) {
  const tabs = [["accueil", "Accueil", HIco.home], ["cours", "Cours", HIco.book], ["journal", "Journal", HIco.journal], ["badges", "Badges", HIco.award]];
  return /*#__PURE__*/React.createElement("div", {
    className: "hf-tabbar"
  }, tabs.map(([id, l, Ic]) => /*#__PURE__*/React.createElement("div", {
    key: id,
    className: "hf-tab" + (active === id ? " on" : ""),
    onClick: () => onTab(id)
  }, /*#__PURE__*/React.createElement(Ic, null), l)));
}
const SESSIONS = [["1.0", "Quiz diagnostique (10 Q · avant les vidéos)", "15 min", "done"], ["1.1", "Le temps africain & le temps organisationnel", "20 min", "now"], ["1.2", "La matrice des priorités africaine", "20 min", "todo"], ["1.3", "La culture de l'urgence africaine", "20 min", "todo"], ["1.4", "Gérer les interruptions", "20 min", "todo"]];
function App() {
  const [screen, setScreen] = useState("accueil");
  const [playing, setPlaying] = useState(false);
  const [vdone, setVdone] = useState(false);
  const [choice, setChoice] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [progress, setProgress] = useState(38);
  const [toast, setToast] = useState(null);
  const [journalText, setJournalText] = useState("");
  const [device, setDevice] = useState("mobile");
  const [b4submitted, setB4submitted] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setPlaying(false);
      setVdone(true);
    }, 3500);
    return () => clearTimeout(t);
  }, [playing]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);
  const openSession = () => {
    setPlaying(false);
    setVdone(false);
    setChoice(null);
    setSubmitted(false);
    setScreen("session");
  };
  const finishSession = () => {
    setProgress(52);
    setToast("Micro-session 1.1 terminée");
    setScreen("accueil");
  };

  // ---------- screens ----------
  function Accueil() {
    return /*#__PURE__*/React.createElement("div", {
      className: "pt-screen",
      style: {
        padding: 16
      }
    }, device === "mobile" && /*#__PURE__*/React.createElement("div", {
      className: "hf-appbar",
      style: {
        padding: "8px 2px"
      }
    }, /*#__PURE__*/React.createElement(HLogo, null), /*#__PURE__*/React.createElement("div", {
      className: "hf-row g14"
    }, /*#__PURE__*/React.createElement(HIco.bell, {
      style: {
        width: 20,
        height: 20,
        color: "var(--fg-2)"
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "hf-tap",
      onClick: () => setScreen("ancrage"),
      style: {
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "var(--bg-tint)",
        display: "grid",
        placeItems: "center",
        color: "var(--navy-500)",
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: 13
      }
    }, "A"))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "8px 2px 0"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow"
    }, "Gestion du temps & productivit\xE9 \xB7 Niveau 1"), /*#__PURE__*/React.createElement("div", {
      className: "hf-h1 mt6"
    }, "Bonjour Aminata")), /*#__PURE__*/React.createElement("div", {
      className: "hf-card hf-card--peach hf-card--stripe-orange hf-tap mt16",
      onClick: openSession
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow"
    }, "Reprendre"), /*#__PURE__*/React.createElement("div", {
      className: "hf-h3 mt8"
    }, "Bloc 1 \xB7 1.1 \u2014 Le temps africain & le temps organisationnel"), /*#__PURE__*/React.createElement("div", {
      className: "hf-meta mt8",
      style: {
        color: "var(--orange-700)"
      }
    }, "\u21BA Reprise exacte \xB7 vid\xE9o 03:48"), /*#__PURE__*/React.createElement("div", {
      className: "mt14"
    }, /*#__PURE__*/React.createElement(HBtn, {
      kind: "primary",
      block: true,
      arrow: true
    }, "Reprendre"))), /*#__PURE__*/React.createElement("div", {
      className: "hf-card mt14"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-row hf-between",
      style: {
        alignItems: "baseline"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "hf-h4"
    }, "Progression"), /*#__PURE__*/React.createElement("span", {
      className: "hf-num",
      style: {
        fontSize: 20,
        color: "var(--orange-500)"
      }
    }, progress, "%")), /*#__PURE__*/React.createElement("div", {
      className: "mt10"
    }, /*#__PURE__*/React.createElement(HProg, {
      pct: progress
    })), /*#__PURE__*/React.createElement("div", {
      className: "hf-row hf-between mt10"
    }, /*#__PURE__*/React.createElement("span", {
      className: "hf-meta"
    }, "2 / 5 blocs"), /*#__PURE__*/React.createElement("span", {
      className: "hf-meta"
    }, "\u23F1 \u2248 2 h 10 restantes"))), /*#__PURE__*/React.createElement("div", {
      className: "mt16"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow",
      style: {
        color: "var(--navy-400)",
        marginBottom: 10
      }
    }, "Votre parcours"), /*#__PURE__*/React.createElement(HRail, {
      state: ["done", "now", "lock", "lock", "lock"]
    })), /*#__PURE__*/React.createElement("div", {
      className: "hf-card hf-card--mint hf-tap mt16 hf-row g12",
      style: {
        alignItems: "center"
      },
      onClick: () => setToast("M. Diallo a été notifié")
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: "#fff",
        display: "grid",
        placeItems: "center",
        color: "var(--brand-declick)",
        flex: "0 0 38px"
      }
    }, /*#__PURE__*/React.createElement(HIco.users, {
      style: {
        width: 19,
        height: 19
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "hf-grow"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-meta"
    }, "Pair de progression"), /*#__PURE__*/React.createElement("div", {
      className: "hf-h4"
    }, "M. Diallo")), /*#__PURE__*/React.createElement("span", {
      className: "hf-pill hf-pill--mint hf-pill--sm"
    }, /*#__PURE__*/React.createElement(HIco.check, {
      style: {
        width: 12,
        height: 12
      }
    }), "Notifi\xE9")), /*#__PURE__*/React.createElement("div", {
      className: "mt16 hf-tap",
      onClick: () => setScreen("badges")
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow",
      style: {
        color: "var(--navy-400)",
        marginBottom: 10
      }
    }, "Badges"), /*#__PURE__*/React.createElement("div", {
      className: "hf-row hf-between"
    }, /*#__PURE__*/React.createElement(HMedal, {
      kind: "earned",
      label: "Entr\xE9e"
    }), /*#__PURE__*/React.createElement(HMedal, {
      kind: "earned",
      label: "Compr."
    }), /*#__PURE__*/React.createElement(HMedal, {
      label: "Prat."
    }), /*#__PURE__*/React.createElement(HMedal, {
      label: "Ancr."
    }), /*#__PURE__*/React.createElement(HMedal, {
      kind: "cert",
      label: "Niv. 1"
    }))));
  }
  function Cours() {
    return /*#__PURE__*/React.createElement("div", {
      className: "pt-screen",
      style: {
        padding: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "8px 2px 0"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow"
    }, "Bloc 1 \u2014 Comprendre les dynamiques du temps"), /*#__PURE__*/React.createElement("div", {
      className: "hf-h1 mt6",
      style: {
        fontSize: 24
      }
    }, "6 micro-sessions"), /*#__PURE__*/React.createElement("div", {
      className: "hf-meta mt6"
    }, "Faites-les dans l'ordre que vous voulez.")), /*#__PURE__*/React.createElement("div", {
      className: "hf-col g10 mt14"
    }, SESSIONS.map(([i, t, d, st]) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "hf-card hf-card--tight hf-row g12 hf-rowtap",
      style: {
        alignItems: "center"
      },
      onClick: () => st !== "todo" || true ? openSession() : null
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 52,
        height: 40,
        borderRadius: 10,
        flex: "0 0 52px",
        display: "grid",
        placeItems: "center",
        background: st === "done" ? "var(--brand-declick-tint)" : "var(--navy-50)",
        color: st === "done" ? "var(--brand-declick)" : "var(--navy-300)"
      }
    }, st === "done" ? /*#__PURE__*/React.createElement(HIco.check, {
      style: {
        width: 18,
        height: 18
      }
    }) : /*#__PURE__*/React.createElement(HIco.book, {
      style: {
        width: 16,
        height: 16
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "hf-grow"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-h4",
      style: {
        fontSize: 13,
        lineHeight: 1.2
      }
    }, t), /*#__PURE__*/React.createElement("div", {
      className: "hf-row g8 mt6",
      style: {
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "hf-pill hf-pill--orange hf-pill--sm"
    }, "\u25F7 ", d), st === "done" && /*#__PURE__*/React.createElement("span", {
      className: "hf-meta hf-check",
      style: {
        fontWeight: 700
      }
    }, "Termin\xE9e"))), /*#__PURE__*/React.createElement(HIco.chevron, {
      style: {
        width: 18,
        height: 18,
        color: "var(--fg-3)"
      }
    })))));
  }
  function Session() {
    return /*#__PURE__*/React.createElement("div", {
      className: "pt-screen",
      style: {
        padding: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-row g10",
      style: {
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-tap",
      onClick: () => setScreen("cours"),
      style: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "var(--bg-soft)",
        display: "grid",
        placeItems: "center",
        transform: "scaleX(-1)"
      }
    }, /*#__PURE__*/React.createElement(HIco.chevron, {
      style: {
        width: 18,
        height: 18,
        color: "var(--navy-500)"
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "hf-pill hf-pill--soft hf-pill--sm"
    }, "Bloc 1 \xB7 1.1"), /*#__PURE__*/React.createElement("span", {
      className: "hf-grow"
    }), /*#__PURE__*/React.createElement("span", {
      className: "hf-meta",
      style: {
        fontWeight: 700
      }
    }, "\u25F7 20 min")), /*#__PURE__*/React.createElement("div", {
      className: "hf-h3 mt12"
    }, "Le temps africain & le temps organisationnel"), /*#__PURE__*/React.createElement("div", {
      className: "mt12"
    }, /*#__PURE__*/React.createElement(PtVideo, {
      playing: playing,
      done: vdone,
      onPlay: () => setPlaying(true)
    })), /*#__PURE__*/React.createElement("div", {
      className: "hf-meta mt8",
      style: {
        color: "var(--orange-700)"
      }
    }, playing ? "Lecture en cours…" : vdone ? "Vidéo terminée ✓" : "Touchez pour lire · ↺ reprise 03:48 · ↓ hors-ligne"), vdone && /*#__PURE__*/React.createElement("div", {
      className: "pt-reveal hf-card hf-card--stripe-orange mt16"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow"
    }, "Micro-exercice \u2014 obligatoire"), /*#__PURE__*/React.createElement("div", {
      className: "hf-h3 mt6",
      style: {
        fontSize: 16
      }
    }, "Cartographier mes deux types de temps"), /*#__PURE__*/React.createElement("div", {
      className: "mt10"
    }, /*#__PURE__*/React.createElement(HPam, null, "\xAB D'apr\xE8s ", /*#__PURE__*/React.createElement("em", null, "la journ\xE9e que vous avez d\xE9crite au Bloc 0"), ", classez vos activit\xE9s entre temps polychronique et monochronique. \xBB")), /*#__PURE__*/React.createElement("div", {
      className: "hf-col g8 mt12"
    }, [["poly", "Activité polychronique", "WhatsApp, visites, sollicitations"], ["mono", "Activité monochronique", "votre dossier prioritaire"]].map(([id, l, ex]) => /*#__PURE__*/React.createElement("div", {
      key: id,
      className: "pt-opt hf-card hf-card--tight" + (choice === id ? " sel" : ""),
      style: {
        boxShadow: "none",
        padding: "11px 13px"
      },
      onClick: () => !submitted && setChoice(id)
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-row hf-between",
      style: {
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-h4",
      style: {
        fontSize: 12.5
      }
    }, l), choice === id && /*#__PURE__*/React.createElement("span", {
      className: "hf-check hf-pop"
    }, /*#__PURE__*/React.createElement(HIco.check, {
      style: {
        width: 16,
        height: 16
      }
    }))), /*#__PURE__*/React.createElement("div", {
      className: "hf-meta mt2"
    }, ex)))), !submitted ? /*#__PURE__*/React.createElement("div", {
      className: "mt12",
      onClick: () => choice && setSubmitted(true),
      style: {
        cursor: choice ? "pointer" : "default"
      }
    }, /*#__PURE__*/React.createElement(HBtn, {
      kind: "primary",
      block: true,
      disabled: !choice,
      arrow: true
    }, choice ? "Valider ma réponse" : "Choisissez une réponse")) : /*#__PURE__*/React.createElement("div", {
      className: "pt-reveal hf-card hf-card--mint hf-card--tight mt12",
      style: {
        boxShadow: "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-h4",
      style: {
        fontSize: 12.5,
        color: "#1c7a39"
      }
    }, "Feedback imm\xE9diat"), /*#__PURE__*/React.createElement("div", {
      className: "hf-body mt4",
      style: {
        fontSize: 12.5
      }
    }, "Bien vu. Votre matin\xE9e \xAB dossier prioritaire \xBB est une zone monochronique \xE0 prot\xE9ger ; le WhatsApp rel\xE8ve du polychronique de l'apr\xE8s-midi.")), submitted && /*#__PURE__*/React.createElement("div", {
      className: "mt14",
      onClick: finishSession,
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(HBtn, {
      kind: "primary",
      block: true,
      arrow: true
    }, "Session suivante"))));
  }
  function Journal() {
    const focusRef = useRef(null);
    return /*#__PURE__*/React.createElement("div", {
      className: "pt-screen",
      style: {
        padding: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "8px 2px 0"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow"
    }, "Journal de suivi \xB7 micro-entr\xE9e J+3"), /*#__PURE__*/React.createElement("div", {
      className: "hf-h1 mt6",
      style: {
        fontSize: 23
      }
    }, "Votre rendez-vous r\xE9flexif"), /*#__PURE__*/React.createElement("div", {
      className: "hf-meta mt4"
    }, "5 min \xB7 50 \xE0 100 mots")), /*#__PURE__*/React.createElement("div", {
      className: "mt14"
    }, /*#__PURE__*/React.createElement(HPam, null, "\xAB Vous aviez d\xE9crit ", /*#__PURE__*/React.createElement("em", null, "votre journ\xE9e \xE0 courir apr\xE8s le WhatsApp"), ". Quel obstacle africain r\xE9el avez-vous rencontr\xE9 en appliquant votre solution, et comment l'avez-vous g\xE9r\xE9 ? \xBB")), /*#__PURE__*/React.createElement("div", {
      className: "hf-textwrap mt12"
    }, /*#__PURE__*/React.createElement("textarea", {
      ref: focusRef,
      className: "hf-field",
      style: {
        minHeight: 120,
        resize: "none",
        display: "block"
      },
      placeholder: "Votre r\xE9flexion\u2026",
      value: journalText,
      onChange: e => setJournalText(e.target.value)
    }), /*#__PURE__*/React.createElement("span", {
      className: "hf-count"
    }, journalText.trim() ? journalText.trim().split(/\s+/).length : 0, " mots")), /*#__PURE__*/React.createElement("div", {
      className: "mt12",
      onClick: () => {
        setToast("Entrée J+3 enregistrée");
        setJournalText("");
      },
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(HBtn, {
      kind: "declick",
      block: true
    }, "Enregistrer l'entr\xE9e")), /*#__PURE__*/React.createElement("div", {
      className: "mt16"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow",
      style: {
        color: "var(--navy-400)",
        marginBottom: 10
      }
    }, "Vos 6 micro-entr\xE9es"), /*#__PURE__*/React.createElement("div", {
      className: "hf-row hf-wrap g8"
    }, [["J+1", "done"], ["J+3", "now"], ["J+5", "todo"], ["J+7", "todo"], ["J+10", "todo"], ["J+14", "todo"]].map(([d, st]) => /*#__PURE__*/React.createElement("span", {
      key: d,
      className: "hf-pill hf-pill--sm" + (st === "done" ? " hf-pill--mint" : st === "now" ? " hf-pill--orange" : " hf-pill--soft")
    }, st === "done" ? /*#__PURE__*/React.createElement(HIco.check, {
      style: {
        width: 12,
        height: 12
      }
    }) : /*#__PURE__*/React.createElement(HIco.clock, {
      style: {
        width: 12,
        height: 12
      }
    }), d)))));
  }
  function Badges() {
    return /*#__PURE__*/React.createElement("div", {
      className: "pt-screen",
      style: {
        padding: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "8px 2px 0"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow"
    }, "Vos badges"), /*#__PURE__*/React.createElement("div", {
      className: "hf-h1 mt6",
      style: {
        fontSize: 24
      }
    }, "Progression certifiante")), /*#__PURE__*/React.createElement("div", {
      className: "hf-col g10 mt14"
    }, [["Entrée", "Bloc 0", "earned", "Obtenu"], ["Compréhension", "Bloc 1", "earned", "Obtenu"], ["Pratique", "Bloc 2", "", "Verrouillé"], ["Ancrage", "Bloc 3", "", "Verrouillé"]].map(([n, b, k, st]) => /*#__PURE__*/React.createElement("div", {
      key: n,
      className: "hf-card hf-card--tight hf-row g12",
      style: {
        alignItems: "center",
        opacity: k ? 1 : .6
      }
    }, /*#__PURE__*/React.createElement(HMedal, {
      kind: k,
      label: n.slice(0, 5)
    }), /*#__PURE__*/React.createElement("div", {
      className: "hf-grow"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-h4"
    }, "Badge ", n), /*#__PURE__*/React.createElement("div", {
      className: "hf-meta mt2"
    }, b)), k ? /*#__PURE__*/React.createElement("span", {
      className: "hf-pill hf-pill--mint hf-pill--sm"
    }, st) : /*#__PURE__*/React.createElement("span", {
      className: "hf-lock"
    }, /*#__PURE__*/React.createElement(HIco.lock, {
      style: {
        width: 13,
        height: 13
      }
    }), st))), /*#__PURE__*/React.createElement("div", {
      className: "hf-card hf-card--peach hf-card--stripe-orange hf-tc hf-tap mt4",
      onClick: () => setScreen("depot")
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        placeItems: "center"
      }
    }, /*#__PURE__*/React.createElement(HMedal, {
      kind: "cert",
      label: "Niveau 1",
      lg: true
    })), /*#__PURE__*/React.createElement("div", {
      className: "hf-h3 mt10"
    }, "Certificat de Niveau 1"), /*#__PURE__*/React.createElement("div", {
      className: "hf-meta mt4",
      style: {
        color: "var(--orange-700)",
        fontWeight: 700
      }
    }, "D\xE9poser mon projet du Bloc 4 pour d\xE9bloquer \u2192"))));
  }
  function Ancrage() {
    return /*#__PURE__*/React.createElement("div", {
      className: "pt-screen",
      style: {
        padding: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-row g10",
      style: {
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-tap",
      onClick: () => setScreen("accueil"),
      style: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "var(--bg-soft)",
        display: "grid",
        placeItems: "center",
        transform: "scaleX(-1)"
      }
    }, /*#__PURE__*/React.createElement(HIco.chevron, {
      style: {
        width: 18,
        height: 18,
        color: "var(--navy-500)"
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "hf-pill hf-pill--soft hf-pill--sm"
    }, "Bloc 0 \xB7 0.1")), /*#__PURE__*/React.createElement("div", {
      className: "mt12"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow"
    }, "Moment d'Ancrage"), /*#__PURE__*/React.createElement("div", {
      className: "hf-h1 mt6",
      style: {
        fontSize: 24
      }
    }, "Votre point de d\xE9part")), /*#__PURE__*/React.createElement("div", {
      className: "mt14"
    }, /*#__PURE__*/React.createElement(HPam, null, "\xAB Mardi : 11 h au bureau \xE0 r\xE9pondre au WhatsApp et aux urgences de mon manager \u2014 et ", /*#__PURE__*/React.createElement("em", null, "mon dossier prioritaire n'a pas avanc\xE9"), ". \xBB")), /*#__PURE__*/React.createElement("div", {
      className: "hf-meta mt10"
    }, "Saisi le 02/03 \xB7 r\xE9utilis\xE9 dans vos exercices, votre journal, vos relances et votre projet de certification."), /*#__PURE__*/React.createElement("div", {
      className: "hf-card hf-card--icy mt14"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow",
      style: {
        color: "var(--navy-500)"
      }
    }, "Profil de gestion du temps"), /*#__PURE__*/React.createElement("div", {
      className: "hf-h2 mt8",
      style: {
        color: "var(--orange-600)"
      }
    }, "R\xE9actif conscient"), /*#__PURE__*/React.createElement("div", {
      className: "hf-body mt6",
      style: {
        fontSize: 12.5
      }
    }, "Vos 2 angles morts : filtrer les urgences impos\xE9es \xB7 prot\xE9ger un temps de fond.")), /*#__PURE__*/React.createElement("div", {
      className: "mt14",
      onClick: () => setScreen("accueil"),
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(HBtn, {
      kind: "primary",
      block: true,
      arrow: true
    }, "Revenir \xE0 l'accueil")));
  }
  function Depot() {
    const critList = [["Organisation personnelle (D4.C1)", "20"], ["Gestion des priorités (D4.C2)", "20"], ["Gestion du temps & interruptions (D4.C3)", "20"], ["Performance durable + journal (D4.C4)", "15"], ["Ancrage culturel africain", "10"], ["Profondeur de l'apprentissage", "15"]];
    return /*#__PURE__*/React.createElement("div", {
      className: "pt-screen",
      style: {
        padding: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-row g10",
      style: {
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-tap",
      onClick: () => setScreen("badges"),
      style: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "var(--bg-soft)",
        display: "grid",
        placeItems: "center",
        transform: "scaleX(-1)"
      }
    }, /*#__PURE__*/React.createElement(HIco.chevron, {
      style: {
        width: 18,
        height: 18,
        color: "var(--navy-500)"
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "hf-pill hf-pill--soft hf-pill--sm"
    }, "Bloc 4 \xB7 Mini-projet certifiant")), /*#__PURE__*/React.createElement("div", {
      className: "mt12"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow"
    }, "Bloc 4"), /*#__PURE__*/React.createElement("div", {
      className: "hf-h1 mt6",
      style: {
        fontSize: 24
      }
    }, "Votre livrable certifiant")), /*#__PURE__*/React.createElement("div", {
      className: "hf-card hf-card--mint hf-card--tight mt12 hf-row g10",
      style: {
        alignItems: "center",
        boxShadow: "none"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "hf-check"
    }, /*#__PURE__*/React.createElement(HIco.check, {
      style: {
        width: 18,
        height: 18
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "hf-body",
      style: {
        fontSize: 12.5
      }
    }, "D\xE9bloqu\xE9 : quiz final Bloc 3 r\xE9ussi \xE0 ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--navy-600)"
      }
    }, "75 %"), " (seuil 70 %)")), /*#__PURE__*/React.createElement("div", {
      className: "mt12"
    }, /*#__PURE__*/React.createElement(HPam, {
      label: "Sujet du mini-projet"
    }, "Identifier le principal probl\xE8me de gestion du temps dans ", /*#__PURE__*/React.createElement("em", null, "votre environnement africain r\xE9el"), ", mettre en \u0153uvre une solution adapt\xE9e \xE0 vos codes culturels, et documenter l'impact sur 14 jours.")), /*#__PURE__*/React.createElement("div", {
      className: "hf-row g8 mt10 hf-wrap"
    }, /*#__PURE__*/React.createElement("span", {
      className: "hf-pill hf-pill--sm"
    }, /*#__PURE__*/React.createElement("span", {
      className: "dot"
    }), "Domaine D4"), /*#__PURE__*/React.createElement("span", {
      className: "hf-pill hf-pill--soft hf-pill--sm"
    }, "N1 \u2014 Fondamentaux")), /*#__PURE__*/React.createElement("div", {
      className: "hf-card mt12"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow",
      style: {
        color: "var(--navy-400)"
      }
    }, "Grille \xB7 r\xE9f. D4 \xB7 /100 \xB7 seuil 70"), /*#__PURE__*/React.createElement("div", {
      className: "hf-col g8 mt10"
    }, critList.map(([c, w]) => /*#__PURE__*/React.createElement("div", {
      key: c,
      className: "hf-row hf-between",
      style: {
        alignItems: "baseline",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "hf-body",
      style: {
        fontSize: 12.5
      }
    }, c), /*#__PURE__*/React.createElement("span", {
      className: "hf-num",
      style: {
        fontSize: 13,
        color: "var(--orange-500)"
      }
    }, w))))), !b4submitted ? /*#__PURE__*/React.createElement("div", {
      className: "hf-card hf-card--icy hf-tc mt12",
      style: {
        border: "1.5px dashed var(--line-strong)"
      }
    }, /*#__PURE__*/React.createElement(HIco.download, {
      style: {
        width: 22,
        height: 22,
        color: "var(--navy-400)"
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "hf-meta mt6",
      style: {
        color: "var(--navy-600)"
      }
    }, "D\xE9poser un fichier ou r\xE9diger en ligne"), /*#__PURE__*/React.createElement("div", {
      className: "mt10",
      onClick: () => {
        setB4submitted(true);
        setToast("Projet soumis · évaluation sous 5 j");
      },
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(HBtn, {
      kind: "primary",
      block: true,
      arrow: true
    }, "Soumettre mon projet"))) : /*#__PURE__*/React.createElement("div", {
      className: "pt-reveal hf-card hf-card--mint mt12"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-row g10",
      style: {
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "hf-check hf-pop"
    }, /*#__PURE__*/React.createElement(HIco.check, {
      style: {
        width: 20,
        height: 20
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "hf-h4",
      style: {
        color: "#1c7a39"
      }
    }, "Projet soumis")), /*#__PURE__*/React.createElement("div", {
      className: "hf-body mt8",
      style: {
        fontSize: 12.5
      }
    }, "En cours d'\xE9valuation par un \xE9valuateur Kompetences Declick \xB7 retour sous 5 jours ouvrables. Votre pair sera notifi\xE9 \xE0 la validation."), /*#__PURE__*/React.createElement("div", {
      className: "mt12",
      onClick: () => setScreen("certificat"),
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(HBtn, {
      kind: "declick",
      block: true,
      arrow: true
    }, "Voir mon r\xE9sultat (simul\xE9)"))));
  }
  function Certificat() {
    return /*#__PURE__*/React.createElement("div", {
      className: "pt-screen",
      style: {
        padding: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-row g10",
      style: {
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-tap",
      onClick: () => setScreen("badges"),
      style: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "var(--bg-soft)",
        display: "grid",
        placeItems: "center",
        transform: "scaleX(-1)"
      }
    }, /*#__PURE__*/React.createElement(HIco.chevron, {
      style: {
        width: 18,
        height: 18,
        color: "var(--navy-500)"
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "hf-pill hf-pill--mint hf-pill--sm"
    }, "Valid\xE9 \xB7 78 / 100")), /*#__PURE__*/React.createElement("div", {
      className: "hf-tc",
      style: {
        paddingTop: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        placeItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-pop"
    }, /*#__PURE__*/React.createElement(HMedal, {
      kind: "cert",
      label: "Niveau 1",
      lg: true
    }))), /*#__PURE__*/React.createElement("div", {
      className: "hf-h1 mt12",
      style: {
        fontSize: 22
      }
    }, "Certificat de Niveau 1 obtenu"), /*#__PURE__*/React.createElement("div", {
      className: "hf-body mt8"
    }, "Gestion du Temps & Productivit\xE9 en Environnements Professionnels Africains \xB7 d\xE9livr\xE9 par Kompetences Declick")), /*#__PURE__*/React.createElement("div", {
      className: "hf-card hf-card--peach mt16"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-meta",
      style: {
        color: "var(--orange-700)"
      }
    }, "Conforme Open Badges 2.0"), /*#__PURE__*/React.createElement("div", {
      className: "mt10",
      onClick: () => setToast("Ajouté à votre profil LinkedIn"),
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(HBtn, {
      kind: "declick",
      block: true
    }, /*#__PURE__*/React.createElement(HIco.linkedin, {
      style: {
        width: 16,
        height: 16
      }
    }), "Ajouter \xE0 LinkedIn"))), /*#__PURE__*/React.createElement("div", {
      className: "hf-card hf-card--tight mt12"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hf-eyebrow",
      style: {
        color: "var(--navy-400)"
      }
    }, "V\xE9rification employeur \xB7 URL publique"), /*#__PURE__*/React.createElement("div", {
      className: "hf-field mt8",
      style: {
        fontSize: 11.5,
        padding: "10px 12px",
        color: "var(--fg-3)"
      }
    }, "verify.declick.kompetences.net/c/8F2A-\u2026"), /*#__PURE__*/React.createElement("div", {
      className: "hf-meta mt8"
    }, "V\xE9rifiable sans compte ni action de l'apprenant.")), /*#__PURE__*/React.createElement("div", {
      className: "mt12",
      onClick: () => setScreen("accueil"),
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(HBtn, {
      kind: "outline",
      block: true
    }, "Retour \xE0 l'accueil")));
  }
  const screens = {
    accueil: Accueil,
    cours: Cours,
    session: Session,
    journal: Journal,
    badges: Badges,
    ancrage: Ancrage,
    depot: Depot,
    certificat: Certificat
  };
  const Cur = screens[screen] || Accueil;
  const showTabs = ["accueil", "cours", "journal", "badges"].includes(screen);
  const navList = [["accueil", "Accueil", HIco.home], ["cours", "Cours", HIco.book], ["journal", "Journal", HIco.journal], ["badges", "Badges", HIco.award]];
  const go = id => {
    if (id === "session") openSession();else setScreen(id);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      padding: "22px 24px 44px",
      background: "#eef1f5"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: "var(--r-pill)",
      padding: 4,
      boxShadow: "var(--shadow-xs)",
      fontFamily: "var(--font-display)"
    }
  }, [["mobile", "Mobile"], ["desktop", "Desktop"]].map(([d, l]) => /*#__PURE__*/React.createElement("div", {
    key: d,
    className: "hf-tap",
    onClick: () => setDevice(d),
    style: {
      padding: "8px 20px",
      borderRadius: "var(--r-pill)",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
      background: device === d ? "var(--navy-600)" : "transparent",
      color: device === d ? "#fff" : "var(--fg-2)"
    }
  }, l)))), device === "mobile" ? /*#__PURE__*/React.createElement("div", {
    className: "hf",
    style: {
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hf-phone",
    style: {
      flex: "0 0 360px",
      width: 360
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hf-phone__notch"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hf-phone__status"
  }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", null, "Declick")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 740,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: showTabs ? 740 - 78 : 740,
      overflowY: "auto"
    },
    key: screen
  }, /*#__PURE__*/React.createElement(Cur, null), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 24
    }
  })), showTabs && /*#__PURE__*/React.createElement(PtTabs, {
    active: screen,
    onTab: go
  }), toast && /*#__PURE__*/React.createElement("div", {
    className: "pt-toast"
  }, /*#__PURE__*/React.createElement(HIco.check, {
    style: {
      width: 16,
      height: 16
    }
  }), toast))), /*#__PURE__*/React.createElement("div", {
    className: "hf-notes",
    style: {
      alignSelf: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hf-notes__h"
  }, "Prototype cliquable"), /*#__PURE__*/React.createElement("div", {
    className: "hf-note"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hf-note__n"
  }, "\u21B3"), /*#__PURE__*/React.createElement("div", {
    className: "hf-note__t"
  }, /*#__PURE__*/React.createElement("b", null, "Accueil"), " \u2192 \xAB Reprendre \xBB ouvre la micro-session.")), /*#__PURE__*/React.createElement("div", {
    className: "hf-note"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hf-note__n"
  }, "\u25B6"), /*#__PURE__*/React.createElement("div", {
    className: "hf-note__t"
  }, "Dans la session, ", /*#__PURE__*/React.createElement("b", null, "touchez la vid\xE9o"), " : elle se lit, puis l'exercice appara\xEEt.")), /*#__PURE__*/React.createElement("div", {
    className: "hf-note"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hf-note__n"
  }, "\u2605"), /*#__PURE__*/React.createElement("div", {
    className: "hf-note__t"
  }, /*#__PURE__*/React.createElement("b", null, "Badges"), " \u2192 carte certificat ouvre le ", /*#__PURE__*/React.createElement("b", null, "Bloc 4"), " : d\xE9p\xF4t \u2192 r\xE9sultat \u2192 certificat.")), /*#__PURE__*/React.createElement("div", {
    className: "hf-note"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hf-note__n"
  }, "\u21C4"), /*#__PURE__*/React.createElement("div", {
    className: "hf-note__t"
  }, "Basculez ", /*#__PURE__*/React.createElement("b", null, "Mobile / Desktop"), " en haut \u2014 m\xEAme parcours, deux form factors.")))) : /*#__PURE__*/React.createElement("div", {
    className: "hf",
    style: {
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hf-win",
    style: {
      flex: "0 0 1180px",
      width: 1180
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hf-win__bar"
  }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("div", {
    className: "hf-win__url"
  }, "app.declick.kompetences.net/cours/gestion-du-temps-n1"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: 700
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 244,
      flex: "0 0 244px",
      borderRight: "1px solid var(--line)",
      padding: 18,
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(HLogo, null)), /*#__PURE__*/React.createElement("div", {
    className: "hf-col g4"
  }, navList.map(([id, l, Ic]) => /*#__PURE__*/React.createElement("div", {
    key: id,
    className: "hf-navitem hf-row g10",
    onClick: () => go(id),
    style: {
      padding: "11px 13px",
      borderRadius: 12,
      alignItems: "center",
      background: screen === id ? "var(--orange-50)" : "transparent"
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    style: {
      width: 19,
      height: 19,
      color: screen === id ? "var(--orange-600)" : "var(--fg-3)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: screen === id ? 800 : 600,
      fontSize: 14,
      color: screen === id ? "var(--orange-700)" : "var(--fg-1)"
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    className: "hf-grow"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hf-card hf-card--icy hf-card--tight"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hf-meta"
  }, "Score productivit\xE9 africaine"), /*#__PURE__*/React.createElement("div", {
    className: "hf-row g10 mt8",
    style: {
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(HRing, {
    pct: 64,
    size: 46
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "hf-num",
    style: {
      fontSize: 14,
      color: "var(--navy-600)"
    }
  }, progress, "%"), /*#__PURE__*/React.createElement("div", {
    className: "hf-meta"
  }, "compl\xE9t\xE9")))), /*#__PURE__*/React.createElement("div", {
    className: "hf-row g10 mt12",
    style: {
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: "var(--bg-tint)",
      display: "grid",
      placeItems: "center",
      color: "var(--navy-500)",
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: 13,
      flex: "0 0 32px"
    }
  }, "A"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "hf-h4",
    style: {
      fontSize: 12.5
    }
  }, "Aminata D."), /*#__PURE__*/React.createElement("div", {
    className: "hf-meta"
  }, "Niveau 1")))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      position: "relative",
      background: "var(--bg-soft)"
    },
    key: screen + device
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 660,
      margin: "0 auto",
      padding: "10px 14px 28px"
    }
  }, /*#__PURE__*/React.createElement(Cur, null)), toast && /*#__PURE__*/React.createElement("div", {
    className: "pt-toast"
  }, /*#__PURE__*/React.createElement(HIco.check, {
    style: {
      width: 16,
      height: 16
    }
  }), toast))))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
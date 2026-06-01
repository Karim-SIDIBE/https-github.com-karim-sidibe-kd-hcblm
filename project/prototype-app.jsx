// prototype-app.jsx — Clickable mobile prototype of the Declick learner journey.
// Reuses hf-kit components; adds real state: navigation, active video, exercise, journal.
const { useState, useEffect, useRef } = React;

/* interactive video player */
function PtVideo({ playing, done, onPlay }) {
  return (
    <div className={"hf-media" + (playing ? " is-playing" : "")} style={{ height: 184, borderRadius: "var(--r-lg)" }} onClick={(!playing && !done) ? onPlay : undefined}>
      <div className="play" />
      <div className="topchip">{playing ? <><span className="hf-livedot" />Lecture · 03:48</> : (done ? <><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brand-declick)" }} />Terminée</> : <><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brand-declick)" }} />Auto 480p</>)}</div>
      <div className="chips"><span className="chip">ST</span><span className="chip">1×</span></div>
      <div className="scrub"><i style={{ width: (done ? 100 : playing ? 100 : 38) + "%", transition: playing ? "width 3.4s linear" : "width .25s" }} /></div>
    </div>
  );
}

function PtTabs({ active, onTab }) {
  const tabs = [["accueil", "Accueil", HIco.home], ["cours", "Cours", HIco.book], ["journal", "Journal", HIco.journal], ["badges", "Badges", HIco.award]];
  return (
    <div className="hf-tabbar">
      {tabs.map(([id, l, Ic]) => <div key={id} className={"hf-tab" + (active === id ? " on" : "")} onClick={() => onTab(id)}><Ic />{l}</div>)}
    </div>
  );
}

const SESSIONS = [
  ["1.0", "Quiz diagnostique (10 Q · avant les vidéos)", "15 min", "done"],
  ["1.1", "Le temps africain & le temps organisationnel", "20 min", "now"],
  ["1.2", "La matrice des priorités africaine", "20 min", "todo"],
  ["1.3", "La culture de l'urgence africaine", "20 min", "todo"],
  ["1.4", "Gérer les interruptions", "20 min", "todo"],
];

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
    const t = setTimeout(() => { setPlaying(false); setVdone(true); }, 3500);
    return () => clearTimeout(t);
  }, [playing]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const openSession = () => { setPlaying(false); setVdone(false); setChoice(null); setSubmitted(false); setScreen("session"); };
  const finishSession = () => { setProgress(52); setToast("Micro-session 1.1 terminée"); setScreen("accueil"); };

  // ---------- screens ----------
  function Accueil() {
    return (
      <div className="pt-screen" style={{ padding: 16 }}>
        {device === "mobile" && (
        <div className="hf-appbar" style={{ padding: "8px 2px" }}>
          <HLogo />
          <div className="hf-row g14"><HIco.bell style={{ width: 20, height: 20, color: "var(--fg-2)" }} /><div className="hf-tap" onClick={() => setScreen("ancrage")} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-tint)", display: "grid", placeItems: "center", color: "var(--navy-500)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13 }}>A</div></div>
        </div>
        )}
        <div style={{ padding: "8px 2px 0" }}>
          <div className="hf-eyebrow">Gestion du temps & productivité · Niveau 1</div>
          <div className="hf-h1 mt6">Bonjour Aminata</div>
        </div>
        <div className="hf-card hf-card--peach hf-card--stripe-orange hf-tap mt16" onClick={openSession}>
          <div className="hf-eyebrow">Reprendre</div>
          <div className="hf-h3 mt8">Bloc 1 · 1.1 — Le temps africain & le temps organisationnel</div>
          <div className="hf-meta mt8" style={{ color: "var(--orange-700)" }}>↺ Reprise exacte · vidéo 03:48</div>
          <div className="mt14"><HBtn kind="primary" block arrow>Reprendre</HBtn></div>
        </div>
        <div className="hf-card mt14">
          <div className="hf-row hf-between" style={{ alignItems: "baseline" }}><span className="hf-h4">Progression</span><span className="hf-num" style={{ fontSize: 20, color: "var(--orange-500)" }}>{progress}%</span></div>
          <div className="mt10"><HProg pct={progress} /></div>
          <div className="hf-row hf-between mt10"><span className="hf-meta">2 / 5 blocs</span><span className="hf-meta">⏱ ≈ 2 h 10 restantes</span></div>
        </div>
        <div className="mt16"><div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 10 }}>Votre parcours</div><HRail state={["done", "now", "lock", "lock", "lock"]} /></div>
        <div className="hf-card hf-card--mint hf-tap mt16 hf-row g12" style={{ alignItems: "center" }} onClick={() => setToast("M. Diallo a été notifié")}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", color: "var(--brand-declick)", flex: "0 0 38px" }}><HIco.users style={{ width: 19, height: 19 }} /></div>
          <div className="hf-grow"><div className="hf-meta">Pair de progression</div><div className="hf-h4">M. Diallo</div></div>
          <span className="hf-pill hf-pill--mint hf-pill--sm"><HIco.check style={{ width: 12, height: 12 }} />Notifié</span>
        </div>
        <div className="mt16 hf-tap" onClick={() => setScreen("badges")}><div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 10 }}>Badges</div>
          <div className="hf-row hf-between"><HMedal kind="earned" label="Entrée" /><HMedal kind="earned" label="Compr." /><HMedal label="Prat." /><HMedal label="Ancr." /><HMedal kind="cert" label="Niv. 1" /></div>
        </div>
      </div>
    );
  }

  function Cours() {
    return (
      <div className="pt-screen" style={{ padding: 16 }}>
        <div style={{ padding: "8px 2px 0" }}>
          <div className="hf-eyebrow">Bloc 1 — Comprendre les dynamiques du temps</div>
          <div className="hf-h1 mt6" style={{ fontSize: 24 }}>6 micro-sessions</div>
          <div className="hf-meta mt6">Faites-les dans l'ordre que vous voulez.</div>
        </div>
        <div className="hf-col g10 mt14">
          {SESSIONS.map(([i, t, d, st]) => (
            <div key={i} className={"hf-card hf-card--tight hf-row g12 hf-rowtap"} style={{ alignItems: "center" }} onClick={() => st !== "todo" || true ? openSession() : null}>
              <div style={{ width: 52, height: 40, borderRadius: 10, flex: "0 0 52px", display: "grid", placeItems: "center", background: st === "done" ? "var(--brand-declick-tint)" : "var(--navy-50)", color: st === "done" ? "var(--brand-declick)" : "var(--navy-300)" }}>{st === "done" ? <HIco.check style={{ width: 18, height: 18 }} /> : <HIco.book style={{ width: 16, height: 16 }} />}</div>
              <div className="hf-grow"><div className="hf-h4" style={{ fontSize: 13, lineHeight: 1.2 }}>{t}</div><div className="hf-row g8 mt6" style={{ alignItems: "center" }}><span className="hf-pill hf-pill--orange hf-pill--sm">◷ {d}</span>{st === "done" && <span className="hf-meta hf-check" style={{ fontWeight: 700 }}>Terminée</span>}</div></div>
              <HIco.chevron style={{ width: 18, height: 18, color: "var(--fg-3)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  function Session() {
    return (
      <div className="pt-screen" style={{ padding: 16 }}>
        <div className="hf-row g10" style={{ alignItems: "center" }}>
          <div className="hf-tap" onClick={() => setScreen("cours")} style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg-soft)", display: "grid", placeItems: "center", transform: "scaleX(-1)" }}><HIco.chevron style={{ width: 18, height: 18, color: "var(--navy-500)" }} /></div>
          <span className="hf-pill hf-pill--soft hf-pill--sm">Bloc 1 · 1.1</span><span className="hf-grow" /><span className="hf-meta" style={{ fontWeight: 700 }}>◷ 20 min</span>
        </div>
        <div className="hf-h3 mt12">Le temps africain & le temps organisationnel</div>
        <div className="mt12"><PtVideo playing={playing} done={vdone} onPlay={() => setPlaying(true)} /></div>
        <div className="hf-meta mt8" style={{ color: "var(--orange-700)" }}>{playing ? "Lecture en cours…" : vdone ? "Vidéo terminée ✓" : "Touchez pour lire · ↺ reprise 03:48 · ↓ hors-ligne"}</div>

        {vdone && (
          <div className="pt-reveal hf-card hf-card--stripe-orange mt16">
            <div className="hf-eyebrow">Micro-exercice — obligatoire</div>
            <div className="hf-h3 mt6" style={{ fontSize: 16 }}>Cartographier mes deux types de temps</div>
            <div className="mt10"><HPam>« D'après <em>la journée que vous avez décrite au Bloc 0</em>, classez vos activités entre temps polychronique et monochronique. »</HPam></div>
            <div className="hf-col g8 mt12">
              {[["poly", "Activité polychronique", "WhatsApp, visites, sollicitations"], ["mono", "Activité monochronique", "votre dossier prioritaire"]].map(([id, l, ex]) => (
                <div key={id} className={"pt-opt hf-card hf-card--tight" + (choice === id ? " sel" : "")} style={{ boxShadow: "none", padding: "11px 13px" }} onClick={() => !submitted && setChoice(id)}>
                  <div className="hf-row hf-between" style={{ alignItems: "center" }}><div className="hf-h4" style={{ fontSize: 12.5 }}>{l}</div>{choice === id && <span className="hf-check hf-pop"><HIco.check style={{ width: 16, height: 16 }} /></span>}</div>
                  <div className="hf-meta mt2">{ex}</div>
                </div>
              ))}
            </div>
            {!submitted
              ? <div className="mt12" onClick={() => choice && setSubmitted(true)} style={{ cursor: choice ? "pointer" : "default" }}><HBtn kind="primary" block disabled={!choice} arrow>{choice ? "Valider ma réponse" : "Choisissez une réponse"}</HBtn></div>
              : <div className="pt-reveal hf-card hf-card--mint hf-card--tight mt12" style={{ boxShadow: "none" }}><div className="hf-h4" style={{ fontSize: 12.5, color: "#1c7a39" }}>Feedback immédiat</div><div className="hf-body mt4" style={{ fontSize: 12.5 }}>Bien vu. Votre matinée « dossier prioritaire » est une zone monochronique à protéger ; le WhatsApp relève du polychronique de l'après-midi.</div></div>}
            {submitted && <div className="mt14" onClick={finishSession} style={{ cursor: "pointer" }}><HBtn kind="primary" block arrow>Session suivante</HBtn></div>}
          </div>
        )}
      </div>
    );
  }

  function Journal() {
    const focusRef = useRef(null);
    return (
      <div className="pt-screen" style={{ padding: 16 }}>
        <div style={{ padding: "8px 2px 0" }}><div className="hf-eyebrow">Journal de suivi · micro-entrée J+3</div><div className="hf-h1 mt6" style={{ fontSize: 23 }}>Votre rendez-vous réflexif</div><div className="hf-meta mt4">5 min · 50 à 100 mots</div></div>
        <div className="mt14"><HPam>« Vous aviez décrit <em>votre journée à courir après le WhatsApp</em>. Quel obstacle africain réel avez-vous rencontré en appliquant votre solution, et comment l'avez-vous géré ? »</HPam></div>
        <div className="hf-textwrap mt12">
          <textarea ref={focusRef} className="hf-field" style={{ minHeight: 120, resize: "none", display: "block" }} placeholder="Votre réflexion…" value={journalText} onChange={(e) => setJournalText(e.target.value)} />
          <span className="hf-count">{journalText.trim() ? journalText.trim().split(/\s+/).length : 0} mots</span>
        </div>
        <div className="mt12" onClick={() => { setToast("Entrée J+3 enregistrée"); setJournalText(""); }} style={{ cursor: "pointer" }}><HBtn kind="declick" block>Enregistrer l'entrée</HBtn></div>
        <div className="mt16"><div className="hf-eyebrow" style={{ color: "var(--navy-400)", marginBottom: 10 }}>Vos 6 micro-entrées</div>
          <div className="hf-row hf-wrap g8">{[["J+1", "done"], ["J+3", "now"], ["J+5", "todo"], ["J+7", "todo"], ["J+10", "todo"], ["J+14", "todo"]].map(([d, st]) => <span key={d} className={"hf-pill hf-pill--sm" + (st === "done" ? " hf-pill--mint" : st === "now" ? " hf-pill--orange" : " hf-pill--soft")}>{st === "done" ? <HIco.check style={{ width: 12, height: 12 }} /> : <HIco.clock style={{ width: 12, height: 12 }} />}{d}</span>)}</div>
        </div>
      </div>
    );
  }

  function Badges() {
    return (
      <div className="pt-screen" style={{ padding: 16 }}>
        <div style={{ padding: "8px 2px 0" }}><div className="hf-eyebrow">Vos badges</div><div className="hf-h1 mt6" style={{ fontSize: 24 }}>Progression certifiante</div></div>
        <div className="hf-col g10 mt14">
          {[["Entrée", "Bloc 0", "earned", "Obtenu"], ["Compréhension", "Bloc 1", "earned", "Obtenu"], ["Pratique", "Bloc 2", "", "Verrouillé"], ["Ancrage", "Bloc 3", "", "Verrouillé"]].map(([n, b, k, st]) => (
            <div key={n} className="hf-card hf-card--tight hf-row g12" style={{ alignItems: "center", opacity: k ? 1 : .6 }}>
              <HMedal kind={k} label={n.slice(0, 5)} />
              <div className="hf-grow"><div className="hf-h4">Badge {n}</div><div className="hf-meta mt2">{b}</div></div>
              {k ? <span className="hf-pill hf-pill--mint hf-pill--sm">{st}</span> : <span className="hf-lock"><HIco.lock style={{ width: 13, height: 13 }} />{st}</span>}
            </div>
          ))}
          <div className="hf-card hf-card--peach hf-card--stripe-orange hf-tc hf-tap mt4" onClick={() => setScreen("depot")}>
            <div style={{ display: "grid", placeItems: "center" }}><HMedal kind="cert" label="Niveau 1" lg /></div>
            <div className="hf-h3 mt10">Certificat de Niveau 1</div>
            <div className="hf-meta mt4" style={{ color: "var(--orange-700)", fontWeight: 700 }}>Déposer mon projet du Bloc 4 pour débloquer →</div>
          </div>
        </div>
      </div>
    );
  }

  function Ancrage() {
    return (
      <div className="pt-screen" style={{ padding: 16 }}>
        <div className="hf-row g10" style={{ alignItems: "center" }}>
          <div className="hf-tap" onClick={() => setScreen("accueil")} style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg-soft)", display: "grid", placeItems: "center", transform: "scaleX(-1)" }}><HIco.chevron style={{ width: 18, height: 18, color: "var(--navy-500)" }} /></div>
          <span className="hf-pill hf-pill--soft hf-pill--sm">Bloc 0 · 0.1</span>
        </div>
        <div className="mt12"><div className="hf-eyebrow">Moment d'Ancrage</div><div className="hf-h1 mt6" style={{ fontSize: 24 }}>Votre point de départ</div></div>
        <div className="mt14"><HPam>« Mardi : 11 h au bureau à répondre au WhatsApp et aux urgences de mon manager — et <em>mon dossier prioritaire n'a pas avancé</em>. »</HPam></div>
        <div className="hf-meta mt10">Saisi le 02/03 · réutilisé dans vos exercices, votre journal, vos relances et votre projet de certification.</div>
        <div className="hf-card hf-card--icy mt14"><div className="hf-eyebrow" style={{ color: "var(--navy-500)" }}>Profil de gestion du temps</div><div className="hf-h2 mt8" style={{ color: "var(--orange-600)" }}>Réactif conscient</div><div className="hf-body mt6" style={{ fontSize: 12.5 }}>Vos 2 angles morts : filtrer les urgences imposées · protéger un temps de fond.</div></div>
        <div className="mt14" onClick={() => setScreen("accueil")} style={{ cursor: "pointer" }}><HBtn kind="primary" block arrow>Revenir à l'accueil</HBtn></div>
      </div>
    );
  }

  function Depot() {
    const critList = [["Organisation personnelle (D4.C1)", "20"], ["Gestion des priorités (D4.C2)", "20"], ["Gestion du temps & interruptions (D4.C3)", "20"], ["Performance durable + journal (D4.C4)", "15"], ["Ancrage culturel africain", "10"], ["Profondeur de l'apprentissage", "15"]];
    return (
      <div className="pt-screen" style={{ padding: 16 }}>
        <div className="hf-row g10" style={{ alignItems: "center" }}>
          <div className="hf-tap" onClick={() => setScreen("badges")} style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg-soft)", display: "grid", placeItems: "center", transform: "scaleX(-1)" }}><HIco.chevron style={{ width: 18, height: 18, color: "var(--navy-500)" }} /></div>
          <span className="hf-pill hf-pill--soft hf-pill--sm">Bloc 4 · Mini-projet certifiant</span>
        </div>
        <div className="mt12"><div className="hf-eyebrow">Bloc 4</div><div className="hf-h1 mt6" style={{ fontSize: 24 }}>Votre livrable certifiant</div></div>
        <div className="hf-card hf-card--mint hf-card--tight mt12 hf-row g10" style={{ alignItems: "center", boxShadow: "none" }}><span className="hf-check"><HIco.check style={{ width: 18, height: 18 }} /></span><div className="hf-body" style={{ fontSize: 12.5 }}>Débloqué : quiz final Bloc 3 réussi à <b style={{ color: "var(--navy-600)" }}>75 %</b> (seuil 70 %)</div></div>
        <div className="mt12"><HPam label="Sujet du mini-projet">Identifier le principal problème de gestion du temps dans <em>votre environnement africain réel</em>, mettre en œuvre une solution adaptée à vos codes culturels, et documenter l'impact sur 14 jours.</HPam></div>
        <div className="hf-row g8 mt10 hf-wrap"><span className="hf-pill hf-pill--sm"><span className="dot" />Domaine D4</span><span className="hf-pill hf-pill--soft hf-pill--sm">N1 — Fondamentaux</span></div>
        <div className="hf-card mt12">
          <div className="hf-eyebrow" style={{ color: "var(--navy-400)" }}>Grille · réf. D4 · /100 · seuil 70</div>
          <div className="hf-col g8 mt10">{critList.map(([c, w]) => <div key={c} className="hf-row hf-between" style={{ alignItems: "baseline", gap: 10 }}><span className="hf-body" style={{ fontSize: 12.5 }}>{c}</span><span className="hf-num" style={{ fontSize: 13, color: "var(--orange-500)" }}>{w}</span></div>)}</div>
        </div>
        {!b4submitted ? (
          <div className="hf-card hf-card--icy hf-tc mt12" style={{ border: "1.5px dashed var(--line-strong)" }}>
            <HIco.download style={{ width: 22, height: 22, color: "var(--navy-400)" }} />
            <div className="hf-meta mt6" style={{ color: "var(--navy-600)" }}>Déposer un fichier ou rédiger en ligne</div>
            <div className="mt10" onClick={() => { setB4submitted(true); setToast("Projet soumis · évaluation sous 5 j"); }} style={{ cursor: "pointer" }}><HBtn kind="primary" block arrow>Soumettre mon projet</HBtn></div>
          </div>
        ) : (
          <div className="pt-reveal hf-card hf-card--mint mt12">
            <div className="hf-row g10" style={{ alignItems: "center" }}><span className="hf-check hf-pop"><HIco.check style={{ width: 20, height: 20 }} /></span><div className="hf-h4" style={{ color: "#1c7a39" }}>Projet soumis</div></div>
            <div className="hf-body mt8" style={{ fontSize: 12.5 }}>En cours d'évaluation par un évaluateur Kompetences Declick · retour sous 5 jours ouvrables. Votre pair sera notifié à la validation.</div>
            <div className="mt12" onClick={() => setScreen("certificat")} style={{ cursor: "pointer" }}><HBtn kind="declick" block arrow>Voir mon résultat (simulé)</HBtn></div>
          </div>
        )}
      </div>
    );
  }

  function Certificat() {
    return (
      <div className="pt-screen" style={{ padding: 16 }}>
        <div className="hf-row g10" style={{ alignItems: "center" }}>
          <div className="hf-tap" onClick={() => setScreen("badges")} style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg-soft)", display: "grid", placeItems: "center", transform: "scaleX(-1)" }}><HIco.chevron style={{ width: 18, height: 18, color: "var(--navy-500)" }} /></div>
          <span className="hf-pill hf-pill--mint hf-pill--sm">Validé · 78 / 100</span>
        </div>
        <div className="hf-tc" style={{ paddingTop: 14 }}>
          <div style={{ display: "grid", placeItems: "center" }}><div className="hf-pop"><HMedal kind="cert" label="Niveau 1" lg /></div></div>
          <div className="hf-h1 mt12" style={{ fontSize: 22 }}>Certificat de Niveau 1 obtenu</div>
          <div className="hf-body mt8">Gestion du Temps & Productivité en Environnements Professionnels Africains · délivré par Kompetences Declick</div>
        </div>
        <div className="hf-card hf-card--peach mt16"><div className="hf-meta" style={{ color: "var(--orange-700)" }}>Conforme Open Badges 2.0</div><div className="mt10" onClick={() => setToast("Ajouté à votre profil LinkedIn")} style={{ cursor: "pointer" }}><HBtn kind="declick" block><HIco.linkedin style={{ width: 16, height: 16 }} />Ajouter à LinkedIn</HBtn></div></div>
        <div className="hf-card hf-card--tight mt12"><div className="hf-eyebrow" style={{ color: "var(--navy-400)" }}>Vérification employeur · URL publique</div><div className="hf-field mt8" style={{ fontSize: 11.5, padding: "10px 12px", color: "var(--fg-3)" }}>verify.declick.kompetences.net/c/8F2A-…</div><div className="hf-meta mt8">Vérifiable sans compte ni action de l'apprenant.</div></div>
        <div className="mt12" onClick={() => setScreen("accueil")} style={{ cursor: "pointer" }}><HBtn kind="outline" block>Retour à l'accueil</HBtn></div>
      </div>
    );
  }

  const screens = { accueil: Accueil, cours: Cours, session: Session, journal: Journal, badges: Badges, ancrage: Ancrage, depot: Depot, certificat: Certificat };
  const Cur = screens[screen] || Accueil;
  const showTabs = ["accueil", "cours", "journal", "badges"].includes(screen);
  const navList = [["accueil", "Accueil", HIco.home], ["cours", "Cours", HIco.book], ["journal", "Journal", HIco.journal], ["badges", "Badges", HIco.award]];
  const go = (id) => { if (id === "session") openSession(); else setScreen(id); };

  return (
    <div style={{ minHeight: "100vh", padding: "22px 24px 44px", background: "#eef1f5" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <div style={{ display: "inline-flex", background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--r-pill)", padding: 4, boxShadow: "var(--shadow-xs)", fontFamily: "var(--font-display)" }}>
          {[["mobile", "Mobile"], ["desktop", "Desktop"]].map(([d, l]) => <div key={d} className="hf-tap" onClick={() => setDevice(d)} style={{ padding: "8px 20px", borderRadius: "var(--r-pill)", fontWeight: 700, fontSize: 13, cursor: "pointer", background: device === d ? "var(--navy-600)" : "transparent", color: device === d ? "#fff" : "var(--fg-2)" }}>{l}</div>)}
        </div>
      </div>

      {device === "mobile" ? (
        <div className="hf" style={{ justifyContent: "center" }}>
          <div className="hf-phone" style={{ flex: "0 0 360px", width: 360 }}>
            <div className="hf-phone__notch" />
            <div className="hf-phone__status"><span>9:41</span><span>Declick</span></div>
            <div style={{ position: "relative", height: 740, overflow: "hidden" }}>
              <div style={{ height: showTabs ? 740 - 78 : 740, overflowY: "auto" }} key={screen}><Cur /><div style={{ height: 24 }} /></div>
              {showTabs && <PtTabs active={screen} onTab={go} />}
              {toast && <div className="pt-toast"><HIco.check style={{ width: 16, height: 16 }} />{toast}</div>}
            </div>
          </div>
          <div className="hf-notes" style={{ alignSelf: "center" }}>
            <div className="hf-notes__h">Prototype cliquable</div>
            <div className="hf-note"><span className="hf-note__n">↳</span><div className="hf-note__t"><b>Accueil</b> → « Reprendre » ouvre la micro-session.</div></div>
            <div className="hf-note"><span className="hf-note__n">▶</span><div className="hf-note__t">Dans la session, <b>touchez la vidéo</b> : elle se lit, puis l'exercice apparaît.</div></div>
            <div className="hf-note"><span className="hf-note__n">★</span><div className="hf-note__t"><b>Badges</b> → carte certificat ouvre le <b>Bloc 4</b> : dépôt → résultat → certificat.</div></div>
            <div className="hf-note"><span className="hf-note__n">⇄</span><div className="hf-note__t">Basculez <b>Mobile / Desktop</b> en haut — même parcours, deux form factors.</div></div>
          </div>
        </div>
      ) : (
        <div className="hf" style={{ justifyContent: "center" }}>
          <div className="hf-win" style={{ flex: "0 0 1180px", width: 1180 }}>
            <div className="hf-win__bar"><i /><i /><i /><div className="hf-win__url">app.declick.kompetences.net/cours/gestion-du-temps-n1</div><div style={{ width: 44 }} /></div>
            <div style={{ display: "flex", height: 700 }}>
              <div style={{ width: 244, flex: "0 0 244px", borderRight: "1px solid var(--line)", padding: 18, display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: 20 }}><HLogo /></div>
                <div className="hf-col g4">
                  {navList.map(([id, l, Ic]) => (
                    <div key={id} className="hf-navitem hf-row g10" onClick={() => go(id)} style={{ padding: "11px 13px", borderRadius: 12, alignItems: "center", background: screen === id ? "var(--orange-50)" : "transparent" }}>
                      <Ic style={{ width: 19, height: 19, color: screen === id ? "var(--orange-600)" : "var(--fg-3)" }} />
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: screen === id ? 800 : 600, fontSize: 14, color: screen === id ? "var(--orange-700)" : "var(--fg-1)" }}>{l}</span>
                    </div>
                  ))}
                </div>
                <div className="hf-grow" />
                <div className="hf-card hf-card--icy hf-card--tight"><div className="hf-meta">Score productivité africaine</div><div className="hf-row g10 mt8" style={{ alignItems: "center" }}><HRing pct={64} size={46} /><div><div className="hf-num" style={{ fontSize: 14, color: "var(--navy-600)" }}>{progress}%</div><div className="hf-meta">complété</div></div></div></div>
                <div className="hf-row g10 mt12" style={{ alignItems: "center" }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-tint)", display: "grid", placeItems: "center", color: "var(--navy-500)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, flex: "0 0 32px" }}>A</div><div><div className="hf-h4" style={{ fontSize: 12.5 }}>Aminata D.</div><div className="hf-meta">Niveau 1</div></div></div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", position: "relative", background: "var(--bg-soft)" }} key={screen + device}>
                <div style={{ maxWidth: 660, margin: "0 auto", padding: "10px 14px 28px" }}><Cur /></div>
                {toast && <div className="pt-toast"><HIco.check style={{ width: 16, height: 16 }} />{toast}</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);

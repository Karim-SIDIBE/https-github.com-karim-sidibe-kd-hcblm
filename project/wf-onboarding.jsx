// wf-onboarding.jsx — Block 0 onboarding. 3 framing approaches + 4-step detail strip.
// Explores: onboarding flow order & framing, and how the PAM is captured/framed.

function OnbTop({ step, of = 4, label }) {
  return (
    <div style={{ padding: "2px 0 10px" }}>
      <div className="row between center">
        <span className="wf-chip member" style={{ fontSize: 8.5 }}><span className="dot" />Membre de KOMPETENCES AFRICA</span>
        {step && <span className="wf-meta">Étape {step}/{of}</span>}
      </div>
      {step && <div className="mt8"><Rail state={Array.from({ length: of + 1 }).map((_, i) => i < step ? "done" : (i === step ? "now" : "todo"))} /></div>}
    </div>
  );
}

function buildOnboarding() {
  const O = "var(--wf-orange)", G = "var(--wf-green)";

  // ---------- A · wizard linéaire ----------
  const A = (
    <Annotated notesTitle="Direction retenue">
      <Phone>
        <div style={{ padding: 2 }}>
          <OnbTop step={1} label="PAM" />
          <div className="wf-ey">Bloc 0 · 0.1 — Moment d'Ancrage</div>
          <div className="wf-h lg mt6 rel">En une phrase, décrivez <span style={{ color: O }}>votre situation</span><Pin n={1} style={{ position: "absolute", top: -6, right: -6 }} /></div>
          <div className="wf-sub mt8">Une journée récente où vous avez travaillé dur mais terminé sans avoir accompli ce qui comptait vraiment. Tout le parcours s'appuiera dessus.</div>
          <div className="wf-ta-wrap mt10 rel">
            <Pin n={2} style={{ top: -8, right: -8 }} />
            <div className="wf-textarea" style={{ height: 132 }}>Ex. : « Mardi : 11 h au bureau à répondre au WhatsApp et aux urgences de mon manager — et mon dossier prioritaire n'a pas avancé. »</div>
            <span className="wf-ta-count">min. 50 car.</span>
          </div>
          <div className="mt12"><Btn kind="primary" block arrow>Continuer</Btn></div>
          <div className="wf-meta tc mt8" style={{ color: "var(--wf-ink-3)" }}>Obligatoire — vous ne pouvez pas passer cette étape.</div>
        </div>
      </Phone>
      {[
        { n: 1, lvl: "non", cite: "§2.1", text: "Le Moment d'Ancrage est la 1re interaction — dans les 5 premières minutes, avant la vidéo." },
        { n: 2, lvl: "req", cite: "§2.1", text: "Min. 50 caractères, compteur visible, champ mobile sans rognage clavier." },
        { n: 3, lvl: "non", cite: "§2.1", text: "Gate obligatoire : impossible d'avancer sans remplir le Moment d'Ancrage." },
      ].map((x) => <Note key={x.n} {...x} />)}
    </Annotated>
  );

  // ---------- Desktop adaptation (Moment d'Ancrage) ----------
  const D = (
    <div className="wf" style={{ background: "#f4f6f9" }}>
      <Win url="app.declick.kompetences.net/cours/gestion-du-temps-n1/bloc-0">
        <div className="wf-topbar" style={{ padding: "12px 20px" }}>
          <div className="row gap14 center"><Logo /><span className="wf-chip member" style={{ fontSize: 9.5 }}><span className="dot" />Membre de KOMPETENCES AFRICA</span></div>
          <span className="wf-meta">Bloc 0 · Étape 1 / 4</span>
        </div>
        <div style={{ padding: "20px 28px 26px" }}>
          <div style={{ maxWidth: 300 }}><Rail state={["now", "todo", "todo", "todo", "todo"]} /></div>
          <div style={{ display: "flex", gap: 28, marginTop: 20, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div className="wf-ey">Bloc 0 · 0.1 — Moment d'Ancrage</div>
              <div className="wf-h xl mt6" style={{ maxWidth: 520 }}>En une phrase, décrivez <span style={{ color: O }}>votre situation</span></div>
              <div className="wf-sub mt8" style={{ maxWidth: 520 }}>Une journée récente où vous avez travaillé dur mais terminé sans avoir accompli ce qui comptait vraiment. Tout le parcours s'appuiera dessus.</div>
              <div className="wf-ta-wrap mt12" style={{ maxWidth: 520 }}>
                <div className="wf-textarea" style={{ height: 116 }}>Ex. : « Mardi : 11 h au bureau à répondre au WhatsApp et aux urgences de mon manager — et mon dossier prioritaire n'a pas avancé. »</div>
                <span className="wf-ta-count">min. 50 car.</span>
              </div>
              <div className="row gap10 center mt12"><Btn kind="primary" arrow>Continuer</Btn><span className="wf-meta">Obligatoire — impossible de passer cette étape</span></div>
            </div>
            <div style={{ flex: "0 0 250px" }}>
              <div className="wf-card soft" style={{ padding: 14 }}>
                <div className="wf-ey" style={{ marginBottom: 10 }}>Ce que vous allez débloquer</div>
                <div className="col gap8">
                  {[["1", "Moment d'Ancrage", "now"], ["2", "Vidéo + quiz déclencheur", "todo"], ["3", "Profil de gestion du temps", "todo"], ["4", "Pair de progression", "todo"]].map(([i, t, st]) => (
                    <div key={i} className="row gap8 center"><span className={"node " + (st === "now" ? "now" : "")} style={{ width: 22, height: 22, flex: "0 0 22px" }}>{i}</span><span style={{ fontSize: 11.5, fontWeight: st === "now" ? 700 : 500, color: "var(--wf-ink-2)" }}>{t}</span></div>
                  ))}
                </div>
                <div className="wf-card dash tc mt12" style={{ padding: 10 }}><Medal label="ENTRÉE" /><div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 6 }}>Badge Entrée</div></div>
              </div>
            </div>
          </div>
        </div>
      </Win>
      <div className="wf-notes">
        <div className="wf-notes__h">Desktop = secondaire</div>
        <Note n={1} lvl="non" cite="§2.1" text="Même gate qu'en mobile : le Moment d'Ancrage est la 1re interaction, obligatoire." />
        <Note n={2} lvl="non" cite="§4.4" text="Le mobile reste le cas primaire ; le desktop n'ajoute aucune étape." />
        <Note n={3} lvl="non" cite="§7.6" text="Le panneau latéral montre les 4 étapes du Bloc 0 → Badge Entrée." />
      </div>
    </div>
  );

  // ---------- detail strip: les 4 moments du Bloc 0 ----------
  const Strip = (
    <div className="wf" style={{ background: "#f4f6f9", gap: 14, overflow: "hidden" }}>
      {/* PAM */}
      <div className="wf-phone" style={{ flex: "0 0 230px", width: 230 }}>
        <div className="wf-phone__status"><span>9:41</span><span>4G</span></div>
        <div className="wf-phone__body">
          <div className="wf-ey">Étape 1 · Moment d'Ancrage</div>
          <div className="wf-h md mt6">En une phrase…</div>
          <div className="wf-ta-wrap mt8"><div className="wf-textarea" style={{ height: 88 }}>Une journée où vous avez travaillé dur sans accomplir l'essentiel…</div><span className="wf-ta-count">min. 50 car.</span></div>
          <Btn kind="primary" sm block>Continuer</Btn>
        </div>
      </div>
      {/* Quiz + feedback */}
      <div className="wf-phone" style={{ flex: "0 0 230px", width: 230 }}>
        <div className="wf-phone__status"><span>9:41</span><span>4G</span></div>
        <div className="wf-phone__body">
          <div className="wf-ey">Étape 2 · Vidéo + quiz déclencheur</div>
          <div className="wf-img cross mt6" style={{ height: 42, borderRadius: 6 }}><div className="wf-img__play" style={{ width: 22, height: 22 }} /><span className="wf-img__lab wf-meta" style={{ fontSize: 8 }}>« Occupé ou productif ? » · 10 min</span></div>
          <div className="wf-meta mt8" style={{ color: "var(--wf-ink-2)" }}>Quiz déclencheur · 5 Q · non noté</div>
          <div className="col gap6 mt6">
            {[["A", 0], ["B", 1], ["C", 0], ["D", 0]].map(([l, sel]) => <div key={l} style={{ border: "1.5px solid " + (sel ? G : "var(--wf-line)"), background: sel ? "var(--wf-green-t)" : "#fff", borderRadius: 7, padding: "6px 9px", fontSize: 10, color: "var(--wf-ink-2)" }}>{l}. _______</div>)}
          </div>
          <div className="wf-meta mt8" style={{ color: "var(--wf-ink-3)" }}>Aucune réponse incorrecte — chaque choix enrichit votre profil.</div>
        </div>
      </div>
      {/* Profil */}
      <div className="wf-phone" style={{ flex: "0 0 230px", width: 230 }}>
        <div className="wf-phone__status"><span>9:41</span><span>4G</span></div>
        <div className="wf-phone__body">
          <div className="wf-ey">Étape 3 · Profil de gestion du temps</div>
          <div className="wf-card soft mt6" style={{ padding: 8, textAlign: "center" }}><div style={{ fontSize: 12, fontWeight: 800, color: O }}>Réactif conscient</div><div style={{ fontSize: 9, color: "var(--wf-ink-3)", marginTop: 2 }}>généré automatiquement</div></div>
          <div className="wf-sub mt6" style={{ fontSize: 10 }}>Vos 2 angles morts — vos priorités, pas des lacunes.</div>
          <div className="wf-card tint-o mt6" style={{ padding: 8 }}><div style={{ fontSize: 10.5, fontWeight: 700, color: O }}>1 · Filtrer les urgences imposées</div></div>
          <div className="wf-card tint-o mt6" style={{ padding: 8 }}><div style={{ fontSize: 10.5, fontWeight: 700, color: O }}>2 · Protéger un temps de fond</div></div>
        </div>
      </div>
      {/* Pair + badge */}
      <div className="wf-phone" style={{ flex: "0 0 230px", width: 230 }}>
        <div className="wf-phone__status"><span>9:41</span><span>4G</span></div>
        <div className="wf-phone__body">
          <div className="wf-ey">Étape 4 · Pair de progression</div>
          <div className="wf-input mt6" style={{ fontSize: 10 }}>Nom · collègue, mentor, manager</div>
          <div className="wf-input mt6" style={{ fontSize: 10 }}>Email · SMS · WhatsApp</div>
          <div className="wf-meta mt6" style={{ color: "var(--wf-ink-3)" }}>Notifié à chaque badge obtenu.</div>
          <div className="wf-card dash tc mt10" style={{ padding: 10 }}><Medal kind="earned" label="ENTRÉE" /><div style={{ fontSize: 10.5, fontWeight: 700, color: G, marginTop: 6 }}>Badge Entrée débloqué</div><Btn kind="ghost" sm block>Partager LinkedIn</Btn></div>
        </div>
      </div>
      <div className="wf-notes" style={{ flex: "0 0 230px", width: 230 }}>
        <div className="wf-notes__h">Le Bloc 0 en détail</div>
        <Note n={1} lvl="non" cite="§3.1" text="Vidéo déclencheur « Occupé ou productif ? » puis quiz 5 Q non noté qui construit le profil." />
        <Note n={2} lvl="non" cite="§3.2" text="Le profil nomme 2 angles morts prioritaires — pas un score brut." />
        <Note n={3} lvl="req" cite="§7.3" text="Pair notifiable par email ET SMS/WhatsApp." />
      </div>
    </div>
  );

  return (
    <DCSection id="onboarding" title="③ Block 0 — Onboarding (Moment d'Ancrage · déclencheur · pair)" subtitle="Direction retenue : wizard linéaire · mobile + desktop · plus la séquence détaillée des 4 étapes du Bloc 0">
      <DCArtboard id="a" label="Mobile · Moment d'Ancrage (wizard)" width={616} height={672}>{A}</DCArtboard>
      <DCArtboard id="d" label="Desktop · Moment d'Ancrage" width={1160} height={560}>{D}</DCArtboard>
      <DCArtboard id="strip" label="Détail · les 4 étapes du Bloc 0" width={1010} height={430}>{Strip}</DCArtboard>
    </DCSection>
  );
}
window.buildOnboarding = buildOnboarding;

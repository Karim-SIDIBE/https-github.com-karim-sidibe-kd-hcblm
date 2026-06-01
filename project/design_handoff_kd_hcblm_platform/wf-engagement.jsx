// wf-engagement.jsx — Pillar 5 journal + Pillar 6 re-engagement + Progress Peer.
// Highlights the PAM thread in journal prompts and the Day+7 message.

function MsgCard({ tag, channel, tone, title, children, accent, pin }) {
  return (
    <div className="wf-phone" style={{ flex: "0 0 248px", width: 248 }}>
      <div className="wf-phone__status"><span>9:41</span><span>4G</span></div>
      <div className="wf-phone__body">
        <div className="row between center"><span style={{ fontFamily: "var(--wf-mono)", fontSize: 9, fontWeight: 600, color: accent }}>{tag}</span><span className="wf-chip" style={{ fontSize: 8.5 }}>{channel}</span></div>
        <div className="wf-card mt8 rel" style={{ borderTop: "3px solid " + accent }}>
          {pin && <span className="wf-pin abs" style={{ top: -8, right: -8 }}>{pin}</span>}
          <div className="row gap8 center"><div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--wf-fill)", border: "1.5px solid " + accent, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico.bell style={{ width: 11, height: 11, color: accent }} /></div><div style={{ fontSize: 11, fontWeight: 700 }}>{title}</div></div>
          <div className="mt8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function buildEngagement() {
  const O = "var(--wf-orange)", G = "var(--wf-green)", A = "var(--wf-anno)";

  // ---------- Journal (mobile) ----------
  const Journal = (
    <Annotated notesTitle="Journal réflexif">
      <Phone tab={2}>
        <div className="wf-topbar" style={{ margin: "-14px -14px 0", padding: "10px 14px" }}><Logo small /><span className="wf-chip" style={{ fontSize: 9 }}>Bloc 4</span></div>
        <div className="rel" style={{ paddingTop: 12 }}>
          <Pin n={1} style={{ position: "absolute", top: 4, right: -4 }} />
          <div className="wf-ey">Journal de suivi · micro-entrée J+3</div>
          <div className="wf-h md mt6">5 min · 50 à 100 mots</div>
        </div>
        <div className="pam-box mt10 rel">
          <Pin n={2} style={{ top: -8, left: -8 }} />
          « Vous aviez décrit <span className="pam">votre journée à courir après le WhatsApp</span>. Quel obstacle africain réel avez-vous rencontré en appliquant votre solution, et comment l'avez-vous géré ? »
        </div>
        <div className="wf-ta-wrap mt10"><div className="wf-textarea" style={{ height: 96 }}>Votre réflexion…</div><span className="wf-ta-count">50–100 mots</span></div>
        <div className="mt10"><Btn kind="go" block>Enregistrer l'entrée</Btn></div>
        <div className="mt14 rel">
          <Pin n={3} style={{ position: "absolute", top: -2, right: -4 }} />
          <div className="wf-ey" style={{ marginBottom: 8 }}>Vos 6 micro-entrées</div>
          <div className="row gap6 wrap">
            {[["J+1", 1], ["J+3", 1], ["J+5", 0], ["J+7", 0], ["J+10", 0], ["J+14", 0]].map(([d, done]) => (
              <span key={d} className="wf-chip" style={done ? { background: "var(--wf-green-t)", color: G, borderColor: "#b5e3c2" } : {}}>{done ? <Ico.check style={{ width: 10, height: 10 }} /> : <Ico.clock style={{ width: 10, height: 10 }} />}{d}</span>
            ))}
          </div>
          <div className="wf-meta mt8">Micro-entrée 2 / 6 · chaque entrée débloque un élément de la certification</div>
        </div>
      </Phone>
      {[
        { n: 1, lvl: "non", cite: "§6.1", text: "Déclenchement automatique (push/in-app) à J+1, +3, +5, +7, +10, +14 — même si l'apprenant est inactif." },
        { n: 2, lvl: "non", cite: "§6.1 · §2.3", text: "Prompt généré dynamiquement avec le Moment d'Ancrage — jamais générique." },
        { n: 3, lvl: "req", cite: "§6.1", text: "6 micro-entrées de 5 min : la régularité du journal est notée dans la grille (20 pts)." },
      ].map((x) => <Note key={x.n} {...x} />)}
    </Annotated>
  );

  // ---------- Re-engagement sequence (strip of 3) ----------
  const Seq = (
    <div className="wf" style={{ background: "#f4f6f9", gap: 14, overflow: "hidden", alignItems: "flex-start" }}>
      <MsgCard tag="RELANCE J+3" channel="Email + Push" accent={G} title="Votre parcours vous attend" pin={1}>
        <div className="wf-sub" style={{ fontSize: 10.5 }}>Vous en étiez à <b>Bloc 1 · 1.2 — La matrice des priorités</b>. Il vous reste <b>≈ 1 h</b> pour compléter ce bloc.</div>
        <div className="mt8"><Btn kind="go" sm block arrow>Reprendre exactement ici</Btn></div>
        <div className="wf-meta mt6">Lien profond → position exacte</div>
      </MsgCard>
      <MsgCard tag="RELANCE J+7" channel="Email + SMS/WhatsApp" accent={O} title="Votre raison de départ" pin={2}>
        <div className="pam-box" style={{ fontSize: 10.5 }}>« La situation que vous avez décrite — <span className="pam">votre dossier prioritaire qui n'avance jamais</span> — mérite les outils de ce parcours. Reprenez quand vous avez 15 minutes. »</div>
        <div className="mt8"><Btn kind="primary" sm block arrow>Continuer</Btn></div>
      </MsgCard>
      <MsgCard tag="RELANCE J+14" channel="Alerte admin + Email" accent={A} title="Escalade humaine" pin={3}>
        <div className="wf-card soft" style={{ padding: 8 }}>
          <div className="wf-meta">Signalé au responsable / RH (si entreprise)</div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>Aminata D. — inactive 14 j</div>
          <div className="wf-meta mt4">Bloc 1 · 38 % · pour relance humaine</div>
        </div>
        <div className="mt8"><Btn sm block>Voir dans le tableau admin</Btn></div>
      </MsgCard>
      <div className="wf-notes" style={{ flex: "0 0 232px", width: 232 }}>
        <div className="wf-notes__h">Séquence de relance</div>
        <Note n={1} lvl="non" cite="§7.4" text="J+3 : rappel positionnel — micro-session exacte + temps restant + lien profond. Ton encourageant." />
        <Note n={2} lvl="non" cite="§7.4" text="J+7 : reconnexion au Moment d'Ancrage, cité en entier. Le message le plus important." />
        <Note n={3} lvl="non" cite="§7.4" text="J+14 : escalade vers un humain (admin/RH), pas un énième rappel auto." />
        <Note n={4} lvl="crit" cite="Failure 4" text="Jamais culpabilisant ni générique : timing précis, contenu personnalisé." />
      </div>
    </div>
  );

  // ---------- Progress Peer notification (recipient view) ----------
  const Peer = (
    <Annotated notesTitle="Notification au pair">
      <Phone>
        <div className="rel" style={{ paddingTop: 4 }}>
          <Pin n={1} style={{ position: "absolute", top: -2, right: -4 }} />
          <div className="wf-ey">Ce que reçoit le pair · automatique</div>
          <div className="wf-h md mt6">Vue du pair de progression</div>
        </div>
        {/* WhatsApp-like */}
        <div className="wf-card mt10 rel" style={{ borderLeft: "3px solid " + G }}>
          <Pin n={2} style={{ top: -8, right: -8 }} />
          <div className="row between center"><span className="wf-chip" style={{ fontSize: 9, background: "var(--wf-green-t)", color: G, borderColor: "#b5e3c2" }}>WhatsApp / SMS</span><span className="wf-meta">il y a 12 min</span></div>
          <div className="wf-sub mt8" style={{ fontSize: 11 }}><b>Aminata D.</b> vient de débloquer le <b>Badge Compréhension (Bloc 1)</b> du parcours « Gestion du temps & productivité ».</div>
        </div>
        {/* Email */}
        <div className="wf-card mt10" style={{ borderLeft: "3px solid var(--wf-line-2)" }}>
          <div className="row between center"><span className="wf-chip" style={{ fontSize: 9 }}>Email</span><span className="wf-meta">Bloc 0 terminé</span></div>
          <div className="mt8"><Bars n={2} /></div>
        </div>
        <div className="wf-card dash mt12 rel" style={{ padding: 10 }}>
          <Pin n={3} style={{ top: -8, left: -8 }} />
          <div className="wf-meta" style={{ color: "var(--wf-ink-2)" }}>Information seulement — aucune action attendue du pair. Envoyé dans les 2 h suivant chaque bloc.</div>
        </div>
      </Phone>
      {[
        { n: 1, lvl: "non", cite: "§7.3", text: "Pair désigné au Bloc 0, obligatoire pour le Badge Entrée." },
        { n: 2, lvl: "req", cite: "§7.3", text: "Délivrable par email ET SMS/WhatsApp — l'email seul ne suffit pas." },
        { n: 3, lvl: "fail", cite: "Failure 5", text: "Notifications 100 % automatiques : l'apprenant ne choisit pas si son pair est prévenu." },
      ].map((x) => <Note key={x.n} {...x} />)}
    </Annotated>
  );

  // ---------- Desktop adaptation (journal de suivi) ----------
  const entries = [
    ["J+1", "Première réaction concrète de votre environnement africain.", "done"],
    ["J+3", "Quel obstacle africain réel avez-vous rencontré, et comment l'avez-vous géré ?", "now"],
    ["J+5", "Un changement dans votre façon de répondre aux sollicitations ?", "todo"],
    ["J+7", "Qu'avez-vous partagé avec votre pair de progression ?", "todo"],
    ["J+10", "Votre micro-victoire de productivité la plus significative.", "todo"],
    ["J+14", "Ce que le parcours a transformé + vos 3 prochaines occasions.", "todo"],
  ];
  const Jdesk = (
    <div className="wf" style={{ background: "#f4f6f9" }}>
      <Win url="app.declick.kompetences.net/cours/gestion-du-temps-n1/bloc-4/journal">
        <div className="wf-topbar" style={{ padding: "12px 20px" }}>
          <div className="row gap12 center"><Logo /><span className="wf-chip" style={{ fontSize: 9.5 }}>Bloc 4 · Journal de suivi</span></div>
          <span className="wf-meta">Micro-entrée 2 / 6</span>
        </div>
        <div style={{ display: "flex", gap: 0, minHeight: 400 }}>
          {/* entry */}
          <div style={{ flex: "1 1 0", padding: 20, borderRight: "1px solid var(--wf-line)" }}>
            <div className="wf-ey">Micro-entrée J+3 · 5 min · 50 à 100 mots</div>
            <div className="wf-h lg mt4">Votre rendez-vous réflexif</div>
            <div className="pam-box mt12" style={{ maxWidth: 520 }}>« Vous aviez décrit <span className="pam">votre journée à courir après le WhatsApp</span>. Quel obstacle africain réel avez-vous rencontré en appliquant votre solution, et comment l'avez-vous géré ? »</div>
            <div className="wf-ta-wrap mt12" style={{ maxWidth: 520 }}><div className="wf-textarea" style={{ height: 130 }}>Votre réflexion…</div><span className="wf-ta-count">50–100 mots</span></div>
            <div className="row gap10 center mt12"><Btn kind="go">Enregistrer l'entrée</Btn><span className="wf-meta">Prochaine relance auto : J+5</span></div>
          </div>
          {/* timeline */}
          <div style={{ flex: "0 0 320px", padding: 20 }}>
            <div className="wf-ey" style={{ marginBottom: 10 }}>Vos 6 micro-entrées</div>
            <div className="col gap8">
              {entries.map(([d, q, st]) => (
                <div key={d} className="wf-card row gap10" style={{ padding: "9px 11px", alignItems: "flex-start", opacity: st === "todo" ? .7 : 1, borderLeft: "3px solid " + (st === "done" ? G : st === "now" ? O : "var(--wf-line-2)") }}>
                  <span className={"node " + (st === "todo" ? "" : st)} style={{ width: 22, height: 22, flex: "0 0 22px" }}>{st === "done" ? <Ico.check style={{ width: 11, height: 11 }} /> : (st === "now" ? <Ico.bell style={{ width: 11, height: 11 }} /> : <Ico.clock style={{ width: 10, height: 10 }} />)}</span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 11, fontWeight: 700 }}>{d}</div><div className="wf-meta mt2" style={{ fontFamily: "var(--wf-ui)", lineHeight: 1.35 }}>{q}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Win>
      <div className="wf-notes">
        <div className="wf-notes__h">Desktop = secondaire</div>
        <Note n={1} lvl="non" cite="§6.1" text="Déclenchement automatique à J+1, +3, +5, +7, +10, +14 — push/email, même inactif." />
        <Note n={2} lvl="non" cite="§6.1 · §2.3" text="Chaque prompt est généré avec le Moment d'Ancrage — jamais générique." />
        <Note n={3} lvl="req" cite="§6.3 · D4.C4" text="La régularité des 6 entrées est notée dans la grille (Performance durable, 15 pts)." />
      </div>
    </div>
  );

  // ---------- Desktop adaptation (séquence de relance) ----------
  const relances = [
    ["J+3", "Email + Push", "Rappel positionnel", "envoyée", G],
    ["J+7", "Email + SMS/WhatsApp", "Reconnexion au Moment d'Ancrage", "en cours", O],
    ["J+14", "Alerte admin + Email", "Escalade humaine", "à venir", A],
  ];
  const SeqDesk = (
    <div className="wf" style={{ background: "#f4f6f9" }}>
      <Win url="app.declick.kompetences.net/admin/relances/aminata-d">
        <div className="wf-topbar" style={{ padding: "12px 20px" }}>
          <div className="row gap12 center"><Logo /><span className="wf-chip" style={{ fontSize: 9.5 }}>Séquence de relance · automatique</span></div>
          <span className="wf-meta">Aminata D. · inactive depuis 7 j</span>
        </div>
        <div style={{ display: "flex", minHeight: 392 }}>
          {/* sequence rail */}
          <div style={{ flex: "0 0 264px", borderRight: "1px solid var(--wf-line)", padding: 16 }}>
            <div className="wf-ey" style={{ marginBottom: 10 }}>Déclencheurs d'inactivité</div>
            <div className="col gap8">
              {relances.map(([d, ch, t, st, c]) => (
                <div key={d} className="wf-card" style={{ padding: 10, borderLeft: "3px solid " + c, background: st === "en cours" ? "#fff8f2" : "#fff" }}>
                  <div className="row between center"><span style={{ fontSize: 12, fontWeight: 700 }}>{d}</span><span className="wf-meta">{st}</span></div>
                  <div className="wf-h md" style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.2 }}>{t}</div>
                  <div className="wf-meta mt2">{ch}</div>
                </div>
              ))}
            </div>
          </div>
          {/* opened message: J+7 */}
          <div style={{ flex: 1, padding: 20 }}>
            <span className="wf-chip" style={{ fontSize: 9, background: "#fff3e9", color: O, borderColor: "#f6cba3" }}>J+7 · Email + SMS/WhatsApp</span>
            <div className="wf-h lg mt8">Votre raison de départ</div>
            <div className="wf-meta mt4">À : Aminata D. · déclenché automatiquement · jamais groupé avec un digest</div>
            <div className="pam-box mt12" style={{ maxWidth: 560, fontSize: 12 }}>« La situation que vous avez décrite — <span className="pam">votre dossier prioritaire qui n'avance jamais</span> — mérite les outils de ce parcours. Vous êtes à 38 %. Reprenez quand vous avez 15 minutes. »</div>
            <div className="row gap10 center mt14"><Btn kind="primary" arrow>Reprendre exactement ici</Btn><span className="wf-meta">Lien profond → Bloc 1 · 1.2</span></div>
          </div>
        </div>
      </Win>
      <div className="wf-notes">
        <div className="wf-notes__h">Desktop = secondaire</div>
        <Note n={1} lvl="non" cite="§7.4" text="3 relances déclenchées par l'inactivité : J+3 positionnelle, J+7 PAM, J+14 escalade." />
        <Note n={2} lvl="non" cite="§7.4" text="Le J+7 cite le Moment d'Ancrage en entier — message le plus efficace." />
        <Note n={3} lvl="crit" cite="Failure 4" text="Indépendantes des digests, timing précis, jamais génériques." />
      </div>
    </div>
  );

  // ---------- Desktop adaptation (notification au pair) ----------
  const PeerDesk = (
    <div className="wf" style={{ background: "#f4f6f9" }}>
      <Win url="mail.exemple.net · boîte de réception du pair">
        <div className="wf-topbar" style={{ padding: "12px 20px" }}>
          <div className="row gap10 center"><div style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px solid var(--wf-line-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ico.user style={{ width: 14, height: 14, color: "var(--wf-ink-3)" }} /></div><div><div style={{ fontSize: 12, fontWeight: 700 }}>M. Diallo</div><div className="wf-meta">Pair de progression · boîte de réception</div></div></div>
          <span className="wf-chip" style={{ fontSize: 9 }}>Information seulement</span>
        </div>
        <div style={{ display: "flex", minHeight: 392 }}>
          {/* inbox list */}
          <div style={{ flex: "0 0 280px", borderRight: "1px solid var(--wf-line)", padding: 12 }}>
            {[["Badge Compréhension", "Bloc 1 · débloqué · il y a 12 min", "WhatsApp", true], ["Badge Entrée", "Bloc 0 · débloqué · 02/03", "Email", false]].map(([t, m, ch, unread], i) => (
              <div key={i} className="wf-card" style={{ padding: 10, marginBottom: 8, borderLeft: "3px solid " + (unread ? G : "var(--wf-line-2)"), background: unread ? "var(--wf-green-t)" : "#fff" }}>
                <div className="row between center"><span style={{ fontSize: 11.5, fontWeight: unread ? 800 : 600 }}>{t}</span><span className="wf-chip" style={{ fontSize: 8 }}>{ch}</span></div>
                <div className="wf-meta mt4">{m}</div>
              </div>
            ))}
          </div>
          {/* opened message */}
          <div style={{ flex: 1, padding: 20 }}>
            <span className="wf-chip" style={{ fontSize: 9, background: "var(--wf-green-t)", color: G, borderColor: "#b5e3c2" }}>WhatsApp / SMS · automatique</span>
            <div className="wf-h md mt8">Aminata avance dans son parcours</div>
            <div className="wf-card mt12" style={{ padding: 16, maxWidth: 520 }}>
              <div className="wf-sub" style={{ fontSize: 12.5 }}><b>Aminata D.</b> vient de débloquer le <b>Badge Compréhension (Bloc 1)</b> du parcours « Gestion du temps & productivité en environnements professionnels africains ».</div>
              <div className="wf-meta mt10">Vous recevez ce message car Aminata vous a désigné comme pair de progression. Aucune action n'est attendue.</div>
            </div>
            <div className="wf-meta mt12" style={{ color: "var(--wf-ink-3)" }}>Envoyé automatiquement par la plateforme, dans les 2 h suivant la fin du bloc.</div>
          </div>
        </div>
      </Win>
      <div className="wf-notes">
        <div className="wf-notes__h">Desktop = secondaire</div>
        <Note n={1} lvl="non" cite="§7.3" text="Notification automatique au pair à chaque badge — sans action de l'apprenant." />
        <Note n={2} lvl="req" cite="§7.3" text="Délivrable par email ET SMS/WhatsApp ; ici la vue email/inbox du pair." />
        <Note n={3} lvl="fail" cite="Failure 5" text="Pas un bouton « partager » optionnel : l'envoi est systématique et automatique." />
      </div>
    </div>
  );

  return (
    <DCSection id="engagement" title="⑤ Journal de suivi & relances automatiques" subtitle="Le système de complétion : journal Bloc 4 en 6 micro-entrées · la séquence de relance J+3/J+7/J+14 · la notification au pair — chacun en mobile + adaptation desktop">
      <DCArtboard id="journal" label="Mobile · journal de suivi (J+3)" width={616} height={690}>{Journal}</DCArtboard>
      <DCArtboard id="jdesk" label="Desktop · journal de suivi" width={1160} height={600}>{Jdesk}</DCArtboard>
      <DCArtboard id="seq" label="Mobile · séquence de relance J+3/J+7/J+14" width={1024} height={430}>{Seq}</DCArtboard>
      <DCArtboard id="seqdesk" label="Desktop · séquence de relance (J+7 ouvert)" width={1160} height={520}>{SeqDesk}</DCArtboard>
      <DCArtboard id="peer" label="Mobile · notification au pair" width={616} height={560}>{Peer}</DCArtboard>
      <DCArtboard id="peerdesk" label="Desktop · notification au pair (inbox)" width={1160} height={520}>{PeerDesk}</DCArtboard>
    </DCSection>
  );
}
window.buildEngagement = buildEngagement;

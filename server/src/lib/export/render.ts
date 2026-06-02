/**
 * render.ts — render a CourseContent document into portable HTML pages.
 *
 * Pages are format-agnostic: they reference `runtime.js` (provided by each
 * packager) and call a uniform `window.KLMS` API ({ init, complete }), so the
 * SAME pages work inside a SCORM, cmi5 or Common Cartridge package. The host
 * runtime decides how completion/score is reported.
 */
import { MOMENT_ANCRAGE_TOKEN, type CourseContent, type Block } from "../../domain/content-model.js";

export type Page = { id: string; filename: string; title: string; html: string };
export type RenderedCourse = { pages: Page[]; assets: { filename: string; content: string }[] };

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const pam = (s: string) => esc(String(s ?? "").split(MOMENT_ANCRAGE_TOKEN).join("[votre situation décrite au Bloc 0]"));

const STYLE = `
*{box-sizing:border-box}body{font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:820px;margin:0 auto;padding:24px;color:#1f2937;line-height:1.55}
h1{color:#1d4ed8}h2{color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:4px;margin-top:28px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:12px 0}
.muted{color:#64748b}.q{margin:14px 0}.q label{display:block;margin:4px 0;cursor:pointer}
button{background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-size:15px;cursor:pointer;margin-top:8px}
.result{font-weight:600;margin-top:10px}nav a{display:block;padding:6px 0}.ok{color:#15803d}.ko{color:#b91c1c}
`;

/** Render a scored quiz with client-side checking that reports the score. */
function scoredQuiz(qs: { id: string; scenarioText: string; options: { key: string; label: string }[]; correctKey: string; feedbackText: string }[], reportScore: boolean): string {
  const keys = qs.map((q) => q.correctKey);
  const body = qs.map((q, i) => `
  <div class="q" data-i="${i}">
    <p><strong>${i + 1}.</strong> ${esc(q.scenarioText)}</p>
    ${q.options.map((o) => `<label><input type="radio" name="q${i}" value="${esc(o.key)}"> ${esc(o.key)}. ${esc(o.label)}</label>`).join("")}
    <p class="fb muted" hidden>${esc(q.feedbackText)}</p>
  </div>`).join("");
  return `${body}
  <button onclick="checkQuiz(this)">Vérifier mes réponses</button>
  <p class="result" id="res" hidden></p>
  <script>
    var KEYS=${JSON.stringify(keys)};
    function checkQuiz(btn){var n=KEYS.length,ok=0;for(var i=0;i<n;i++){var sel=document.querySelector('input[name="q'+i+'"]:checked');var q=document.querySelector('.q[data-i="'+i+'"]');q.querySelector('.fb').hidden=false;if(sel&&sel.value===KEYS[i]){ok++;}}
      var pct=Math.round(ok/n*100);var r=document.getElementById('res');r.hidden=false;r.textContent='Score : '+ok+'/'+n+' ('+pct+'%)';r.className='result '+(pct>=70?'ok':'ko');
      ${reportScore ? "if(window.KLMS)KLMS.complete(pct);" : ""}}
  </script>`;
}

function page(title: string, bodyHtml: string, autoComplete: boolean): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="stylesheet" href="style.css"><script src="runtime.js"></script></head>
<body>${bodyHtml}
<script>window.addEventListener('load',function(){if(window.KLMS){KLMS.init();${autoComplete ? "KLMS.complete();" : ""}}});</script>
</body></html>`;
}

function renderBlock(b: Block): string {
  let inner = `<h1>${esc(b.title)}</h1>${b.objective ? `<p class="muted">${esc(b.objective)}</p>` : ""}`;
  const video = (v: { title: string; keyMessage?: string; africanExample?: string }) =>
    `<div class="card"><strong>🎬 ${esc(v.title)}</strong>${v.keyMessage ? `<p>${esc(v.keyMessage)}</p>` : ""}${v.africanExample ? `<p class="muted">Exemple : ${esc(v.africanExample)}</p>` : ""}</div>`;
  const micro = (ms: { id: string; title: string; summaryPoints: string[]; video: any; exercise: { prompt: string } }[]) =>
    ms.map((m) => `<h2>${esc(m.id)} — ${esc(m.title)}</h2>${video(m.video)}<ul>${m.summaryPoints.map((p) => `<li>${esc(p)}</li>`).join("")}</ul><div class="card"><em>Exercice :</em> ${pam(m.exercise.prompt)}</div>`).join("");

  switch (b.type) {
    case "ONBOARDING":
      inner += `<div class="card"><strong>Moment d'Ancrage :</strong> ${esc(b.payload.momentAncrage.promptText)}</div>`;
      inner += video(b.payload.triggerVideo);
      inner += `<h2>Profils</h2><ul>${b.payload.profileChoices.map((p) => `<li><strong>${esc(p.key)} — ${esc(p.name)} :</strong> ${esc(p.description)}</li>`).join("")}</ul>`;
      break;
    case "COMPREHENSION":
      inner += `<h2>Quiz diagnostique</h2>` + scoredQuiz(b.payload.diagnosticQuiz.questions, false);
      inner += micro(b.payload.microSessions);
      if (b.payload.caseStudy) inner += `<h2>${esc(b.payload.caseStudy.title)}</h2><ul>${b.payload.caseStudy.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
      break;
    case "PRACTICE":
      inner += micro(b.payload.microSessions);
      if (b.payload.interBlockQuiz) inner += `<h2>Quiz interbloc</h2>` + scoredQuiz(b.payload.interBlockQuiz.questions, false);
      inner += `<div class="card"><strong>Application terrain :</strong> ${pam(b.payload.fieldApplication.brief)}</div>`;
      break;
    case "ANCHORING":
      inner += micro(b.payload.microSessions);
      inner += `<h2>Quiz final</h2>` + scoredQuiz(b.payload.finalQuiz.questions, true);
      break;
    case "CERTIFICATION":
      inner += `<div class="card"><strong>Projet :</strong> ${pam(b.payload.projectBrief)}</div>`;
      inner += `<h2>Sections</h2><ol>${b.payload.sections.map((s) => `<li>${esc(s.title)}</li>`).join("")}</ol>`;
      inner += `<h2>Journal</h2><ul>${b.payload.journal.entries.map((e) => `<li>J+${e.day} : ${pam(e.prompt)}</li>`).join("")}</ul>`;
      inner += `<h2>Grille (${b.payload.rubric.totalPoints} pts, seuil ${b.payload.rubric.threshold})</h2><ul>${b.payload.rubric.criteria.map((c) => `<li>${esc(c.label)} — ${c.weightPoints} pts</li>`).join("")}</ul>`;
      break;
  }
  return inner;
}

export function renderCourse(content: CourseContent): RenderedCourse {
  const blocks = content.blocks;
  const blockPages: Page[] = blocks.map((b) => ({
    id: `BLOCK_${b.index}`, filename: `bloc-${b.index}.html`, title: b.title,
    html: page(b.title, renderBlock(b), b.type !== "ANCHORING"), // scored block completes via the quiz
  }));

  const toc = `<h1>${esc(content.title)}</h1><p class="muted">${esc(content.summary)}</p>
  <p>Domaine ${esc(content.domain.code)} — ${esc(content.domain.label)} · Niveau ${content.level} · Seuil ${content.passThreshold}%</p>
  <h2>Sommaire</h2><nav>${blockPages.map((p) => `<a href="${p.filename}">${esc(p.title)}</a>`).join("")}</nav>`;
  const index: Page = { id: "INDEX", filename: "index.html", title: content.title, html: page(content.title, toc, true) };

  return { pages: [index, ...blockPages], assets: [{ filename: "style.css", content: STYLE }] };
}

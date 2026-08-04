/**
 * widgets.tsx — small shared pieces for the paged admin lists (M2):
 *   <Pager>    real server-side pagination controls
 *   <SortTh>   sortable column header (cycles asc/desc)
 *   <ViewsBar> per-user saved views of a screen's filters (stored server-side)
 */
import { useEffect, useState } from "react";
import { api, type SavedViewRow } from "./api";
import { modal } from "./modal";

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize && page === 1) return <div className="muted" style={{ padding: "10px 2px", fontSize: 12.5 }}>{total} résultat{total > 1 ? "s" : ""}</div>;
  return (
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "10px 2px" }}>
      <span className="muted" style={{ fontSize: 12.5 }}>{total} résultat{total > 1 ? "s" : ""} · page {page}/{pages}</span>
      <span className="row" style={{ gap: 6 }}>
        <button className="btn btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Précédent</button>
        <button className="btn btn--sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Suivant →</button>
      </span>
    </div>
  );
}

/** Sortable <th>. `sort` is the current "field:dir"; clicking cycles the field. */
export function SortTh({ label, field, sort, onSort }: { label: string; field: string; sort: string; onSort: (s: string) => void }) {
  const [f, dir] = sort.split(":");
  const active = f === field;
  const next = active && dir === "desc" ? `${field}:asc` : `${field}:desc`;
  return (
    <th style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} title="Trier" onClick={() => onSort(next)}>
      {label} <span style={{ opacity: active ? 1 : 0.25, fontSize: 10 }}>{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
    </th>
  );
}

/**
 * Saved views of a screen: a <select> of the user's views + save/delete.
 * `config` is the screen's current filter state; `onApply` restores one.
 */
export function ViewsBar({ screen, config, onApply }: { screen: string; config: Record<string, unknown>; onApply: (c: Record<string, unknown>) => void }) {
  const [views, setViews] = useState<SavedViewRow[]>([]);
  const [sel, setSel] = useState("");

  const load = () => api.views(screen).then(setViews).catch(() => {});
  useEffect(() => { load(); }, [screen]);

  async function save() {
    const name = await modal.prompt({ title: "Enregistrer la vue", label: "Nom de la vue", placeholder: "ex. Mes relances de la semaine", initial: views.find((v) => v.id === sel)?.name ?? "" });
    if (!name?.trim()) return;
    const saved = await api.saveView(screen, name.trim(), config).catch(() => null);
    if (saved) { await load(); setSel(saved.id); }
  }
  async function remove() {
    const v = views.find((x) => x.id === sel);
    if (!v) return;
    if (!(await modal.confirm({ title: `Supprimer la vue « ${v.name} » ?`, danger: true }))) return;
    await api.deleteView(v.id).catch(() => {});
    setSel(""); load();
  }

  return (
    <span className="row" style={{ gap: 6, alignItems: "center" }}>
      <select className="select" value={sel} title="Vues enregistrées (suivent votre compte)"
        onChange={(e) => { setSel(e.target.value); const v = views.find((x) => x.id === e.target.value); if (v) onApply(v.config); }}>
        <option value="">Vues…</option>
        {views.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <button className="btn btn--sm" title="Enregistrer les filtres actuels comme vue" onClick={() => void save()}>💾</button>
      {sel && <button className="btn btn--sm" title="Supprimer la vue sélectionnée" onClick={() => void remove()}>🗑️</button>}
    </span>
  );
}

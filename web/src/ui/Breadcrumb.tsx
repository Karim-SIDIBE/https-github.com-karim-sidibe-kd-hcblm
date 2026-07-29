import { useMemo } from "react";
import { blockItems, blockDurationSec } from "../lib/content";
import { formatDuration } from "../lib/format";
import { navigate, routes } from "../lib/router";
import { useT } from "../lib/i18n";

/**
 * Breadcrumb — the harmonised header of every in-course screen (écrans 2–43):
 *   ← Cours
 *   Bloc N · Titre du bloc — durée
 *   Micro-session X.Y — Titre — durée        (the current item, when given)
 * The block duration is the sum of its item estimates (single source:
 * @kd/shared/block-items), so the list, the home card and this header agree.
 */
export function Breadcrumb({ eid, block, itemKey, trailing }: {
  eid: string;
  /** The content block of the current screen (from the cached bundle). */
  block: { index: number; title: string } | null | undefined;
  /** Key of the current item — resolved to its harmonised label + duration. */
  itemKey?: string;
  /** Optional right-aligned slot on the item line (e.g. « ÉTAPE 1 SUR 3 »). */
  trailing?: JSX.Element | string | null;
}) {
  const t = useT();
  const item = useMemo(() => {
    if (!block || !itemKey) return null;
    return blockItems(block as never, t).find((it) => it.key === itemKey) ?? null;
  }, [block, itemKey, t]);
  const blockDur = useMemo(() => (block ? blockDurationSec(block as never, t) : 0), [block, t]);

  return (
    <div className="stack" style={{ gap: 2 }}>
      <button className="hf-btn hf-btn--ghost hf-btn--sm" style={{ paddingLeft: 0, alignSelf: "flex-start" }} onClick={() => navigate(routes.cours(eid))}>
        {t("nav.backCourse")}
      </button>
      {block && (
        <div className="meta" style={{ fontWeight: 600 }}>
          {t("home.block", { n: block.index })} · {block.title}
          {blockDur > 0 ? ` — ${formatDuration(blockDur)}` : ""}
        </div>
      )}
      {(item || trailing) && (
        <div className="row between" style={{ gap: 8 }}>
          <div className="meta">
            {item ? <>{item.label}{item.durationSec ? ` — ${formatDuration(item.durationSec)}` : ""}</> : null}
          </div>
          {trailing ? <div className="eyebrow" style={{ whiteSpace: "nowrap" }}>{trailing}</div> : null}
        </div>
      )}
    </div>
  );
}

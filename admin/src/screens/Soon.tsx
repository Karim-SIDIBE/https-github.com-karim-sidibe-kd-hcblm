import { ISettings } from "../icons";

/** Placeholder for a module whose UI is on the roadmap (engine already exists). */
export function Soon({ title }: { title: string }) {
  return (
    <div className="content">
      <div className="soonwrap">
        <div className="box">
          <div className="ic"><ISettings /></div>
          <div className="eyebrow">Module prévu</div>
          <h2>{title}</h2>
          <p>Le moteur (API) gère déjà cette fonction. L'écran d'administration correspondant est planifié dans les prochaines itérations de la console.</p>
        </div>
      </div>
    </div>
  );
}

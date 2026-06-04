import { useEffect, useState } from "react";

const AV = ["#F36F21", "#112E66", "#2DAA4F", "#2563EB", "#DB5E15", "#1A3B7A"];
export const avatarColor = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
export const initials = (n: string) => (n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();

/** Relative French date from an ISO string. */
export function ago(iso: string | null): string {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (d < 1) return "Aujourd'hui";
  if (d < 2) return "Hier";
  if (d < 30) return `Il y a ${Math.floor(d)} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

/** A strong, human-typable random password (no ambiguous chars). */
export function genPassword(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ", a = "abcdefghijkmnpqrstuvwxyz", n = "23456789", s = "!@#$%&*";
  const all = A + a + n + s;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let p = pick(A) + pick(a) + pick(n) + pick(s);
  for (let i = 0; i < 8; i++) p += pick(all);
  return p.split("").sort(() => Math.random() - 0.5).join("");
}

/** Minimal async-data hook with loading/error. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fn().then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setError(e?.message || "Erreur"); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}

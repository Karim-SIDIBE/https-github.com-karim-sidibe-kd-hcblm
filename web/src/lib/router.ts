/**
 * router.ts — minimal hash router (no dependency, keeps the bundle small for
 * low-spec devices). `parseRoute` is pure and unit-tested; `useRoute` subscribes
 * a component to hash changes.
 */
import { useEffect, useState } from "react";

export type Route =
  | { name: "enrollments" }
  | { name: "course"; eid: string }
  | { name: "session"; eid: string; block: number; item: string }
  | { name: "onboarding"; eid: string }
  | { name: "block"; eid: string; block: number };

/** Parse a location hash (e.g. "#/c/abc/session/3/3.1") into a typed route. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\/+/, "").replace(/\/+$/, "");
  const seg = path ? path.split("/") : [];
  if (seg[0] === "c" && seg[1]) {
    const eid = decodeURIComponent(seg[1]);
    if (seg[2] === "onboarding") return { name: "onboarding", eid };
    if (seg[2] === "session" && seg[3] && seg[4]) return { name: "session", eid, block: Number(seg[3]), item: decodeURIComponent(seg[4]) };
    if (seg[2] === "block" && seg[3]) return { name: "block", eid, block: Number(seg[3]) };
    return { name: "course", eid };
  }
  return { name: "enrollments" };
}

export function navigate(path: string) {
  const target = path.startsWith("#") ? path : `#${path.startsWith("/") ? "" : "/"}${path}`;
  if (location.hash === target) return;
  location.hash = target;
}

/** Build hrefs for the known routes. */
export const routes = {
  enrollments: () => "#/",
  course: (eid: string) => `#/c/${encodeURIComponent(eid)}`,
  onboarding: (eid: string) => `#/c/${encodeURIComponent(eid)}/onboarding`,
  block: (eid: string, block: number) => `#/c/${encodeURIComponent(eid)}/block/${block}`,
  session: (eid: string, block: number, item: string) => `#/c/${encodeURIComponent(eid)}/session/${block}/${encodeURIComponent(item)}`,
};

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

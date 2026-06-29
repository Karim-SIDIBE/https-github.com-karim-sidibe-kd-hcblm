/**
 * native.ts — Capacitor (iOS/Android) runtime enhancements.
 *
 * Active ONLY inside the native shell, feature-detected via the global
 * `window.Capacitor` that the runtime injects. In a browser it's a no-op, and
 * because plugins are reached through `Capacitor.Plugins` (injected by the
 * shell) rather than imported from npm, this adds ZERO weight and zero
 * dependencies to the web PWA — the web build stays identical.
 */
import { navigate } from "./router";
import { api } from "./app";

type Plugins = Record<string, any>;
type Cap = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: Plugins };

function cap(): Cap | null {
  return (window as unknown as { Capacitor?: Cap }).Capacitor ?? null;
}

/** True when running inside the iOS/Android Capacitor shell. */
export function isNative(): boolean {
  return Boolean(cap()?.isNativePlatform?.());
}

const PUSH_TOKEN_KEY = "klms_push_token";

/** Push notifications: request permission, register, and ship the device token
 *  to the backend (linked to the logged-in user). */
function registerPush(P: Plugins): void {
  const Push = P.PushNotifications;
  if (!Push) return;
  Push.addListener?.("registration", (t: { value?: string }) => {
    if (!t?.value) return;
    try { localStorage.setItem(PUSH_TOKEN_KEY, t.value); } catch { /* quota */ }
    void api.registerDevice(t.value, cap()?.getPlatform?.() ?? "web"); // no-op if not logged in yet
  });
  // Tapping a notification with a {route} payload deep-links into the app.
  Push.addListener?.("pushNotificationActionPerformed", (e: { notification?: { data?: { route?: string } } }) => {
    const route = e?.notification?.data?.route;
    if (route) location.hash = route.startsWith("#") ? route : `#${route.startsWith("/") ? "" : "/"}${route}`;
  });
  Push.requestPermissions?.().then((r: { receive?: string }) => {
    if (r?.receive === "granted") Push.register?.();
  }).catch(() => { /* denied / unavailable */ });
}

/** Re-send the saved push token once the user is authenticated (call after login). */
export function syncPushToken(): void {
  if (!isNative()) return;
  let token: string | null = null;
  try { token = localStorage.getItem(PUSH_TOKEN_KEY); } catch { /* */ }
  if (token) void api.registerDevice(token, cap()?.getPlatform?.() ?? "web");
}

/** Wire native behaviours. Safe to call always; returns immediately on web. */
export function initNative(): void {
  const C = cap();
  if (!C?.isNativePlatform?.()) return;
  const P: Plugins = C.Plugins ?? {};

  // Android hardware back button → step back in the hash router; exit at root.
  P.App?.addListener?.("backButton", () => {
    if (location.hash && location.hash !== "#/" && location.hash !== "#") history.back();
    else P.App?.exitApp?.();
  });

  // Deep links (universal/app links + custom scheme) → drive the hash router so
  // e.g. https://app.declick.digital/c/<id>/cours opens the right screen.
  P.App?.addListener?.("appUrlOpen", (e: { url?: string }) => {
    if (!e?.url) return;
    try {
      const u = new URL(e.url);
      if (u.hash) location.hash = u.hash;                     // …/#/c/…
      else if (u.pathname && u.pathname !== "/") navigate(u.pathname + u.search); // …/c/…
    } catch { /* malformed URL — ignore */ }
  });

  // Brand-coloured status bar with light content.
  try {
    P.StatusBar?.setStyle?.({ style: "DARK" });
    P.StatusBar?.setBackgroundColor?.({ color: "#F36F21" }); // Android only; iOS ignores
  } catch { /* plugin absent */ }

  registerPush(P);
  document.documentElement.classList.add("is-native");
}

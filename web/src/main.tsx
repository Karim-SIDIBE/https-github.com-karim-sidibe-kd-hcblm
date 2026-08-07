import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { I18nProvider } from "./lib/i18n";
import { purgeLegacyMediaCaches } from "./lib/offline";
import "./styles.css";

// One-time cleanup of the pre-v2 media cache that could hold poisoned 206
// partials (broke video playback on flaky networks).
purgeLegacyMediaCaches();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><I18nProvider><App /></I18nProvider></React.StrictMode>,
);

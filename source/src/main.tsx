import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator) {
  const had = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((reg) => {
    const up = () => reg.update().catch(() => {});
    up();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") up(); });
  }).catch(() => {}));
}

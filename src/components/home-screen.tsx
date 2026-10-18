"use client";

import { useEffect, useState } from "react";
import { publicBasePath, withBasePath } from "@/lib/format";

type InstallPrompt = Event & { prompt: () => Promise<void> };

export function HomeScreen() {
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const base = publicBasePath();

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const sync = () => setInstalled(media.matches || nav.standalone === true);
    sync();
    media.addEventListener("change", sync);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(withBasePath("/sw.js"), { scope: withBasePath("/") }).catch(() => undefined);
    }
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, [base]);

  if (installed) {
    return (
      <nav className="home-bar" aria-label="Home screen">
        <a href={`${base}/`}>Home</a>
        <a href={`${base}/#chat`}>Chat</a>
      </nav>
    );
  }

  return (
    <div className="home-install">
      <button
        className="btn"
        type="button"
        onClick={() => {
          void promptEvent?.prompt();
        }}
      >
        Add to Home Screen
      </button>
      <span className="note">Quiet hours are 9 PM to 8 AM ET. Notices wait until morning.</span>
    </div>
  );
}

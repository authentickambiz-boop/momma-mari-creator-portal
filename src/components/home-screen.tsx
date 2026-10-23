"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { publicBasePath, withBasePath } from "@/lib/format";
import { QUIET_HOURS_NOTE, homeScreenOffer, isIosHomeScreen } from "@/lib/home-screen";
import { isPublicMarketingPath } from "@/lib/public-site";
import { isBotOfficePath } from "@/lib/worlds/office-path";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function HomeScreen() {
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const base = publicBasePath();
  const pathname = usePathname() ?? "";
  const publicPage = isPublicMarketingPath(pathname, base) || isBotOfficePath(pathname, base);
  const offer = homeScreenOffer({ installed, ios, canPrompt: Boolean(promptEvent) });

  useEffect(() => {
    if (publicPage) return;
    const media = window.matchMedia("(display-mode: standalone)");
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const sync = () => setInstalled(media.matches || nav.standalone === true);
    sync();
    setIos(isIosHomeScreen(nav.userAgent, nav.maxTouchPoints, nav.platform));
    media.addEventListener("change", sync);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(withBasePath("/sw.js"), { scope: withBasePath("/") }).catch(() => undefined);
    }
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [base, publicPage]);

  if (publicPage) return null;

  if (offer === "installed") {
    return (
      <nav className="home-bar" aria-label="Home screen">
        <a href={`${base}/`}>Home</a>
        <a href={`${base}/#chat`}>Chat</a>
      </nav>
    );
  }

  return (
    <div className="home-install">
      {offer === "install" ? (
        <button
          className="btn"
          type="button"
          onClick={() => {
            const pending = promptEvent;
            if (!pending) return;
            void pending.prompt().then(() => pending.userChoice).then((choice) => {
              if (choice.outcome === "accepted") setInstalled(true);
              setPromptEvent(null);
            });
          }}
        >
          Add to Home Screen
        </button>
      ) : null}
      {offer === "ios" ? (
        <p>On iPhone or iPad, tap Share, then Add to Home Screen.</p>
      ) : null}
      <span className="note">{QUIET_HOURS_NOTE}</span>
    </div>
  );
}

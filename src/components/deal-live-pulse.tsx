"use client";

import { useEffect } from "react";
import { withBasePath } from "@/lib/format";

type LiveDeal = {
  id: string;
  brand: string;
  stageLabel: string;
  message: string;
  updatedLabel: string;
};

const WAIT_MS = 12000;

function paint(deal: LiveDeal) {
  const card = document.querySelector(`[data-deal-id="${CSS.escape(deal.id)}"]`);
  const stage = card?.querySelector("[data-live-stage]");
  const stamp = card?.querySelector("[data-live-updated]");
  if (stage) stage.textContent = deal.stageLabel;
  if (stamp) stamp.textContent = deal.updatedLabel;
  const detail = document.querySelector(`[data-deal-detail="${CSS.escape(deal.id)}"]`);
  const detailStamp = detail?.querySelector("[data-live-updated]");
  const detailMessage = detail?.querySelector("[data-live-message]");
  if (detailStamp) detailStamp.textContent = deal.updatedLabel;
  if (detailMessage && deal.message) detailMessage.textContent = deal.message;
}

function appendCard(deal: LiveDeal) {
  const list = document.querySelector("#dealGrid .list");
  if (!list || list.querySelector(`[data-deal-id="${CSS.escape(deal.id)}"]`)) return;
  const link = document.createElement("a");
  link.className = "deal";
  link.dataset.dealId = deal.id;
  link.href = withBasePath(`/deals/${deal.id}${window.location.search}`);
  const top = document.createElement("div");
  top.className = "top";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = deal.brand;
  top.append(name);
  const stage = document.createElement("div");
  stage.className = "note";
  stage.dataset.liveStage = "";
  stage.textContent = deal.stageLabel;
  const stamp = document.createElement("div");
  stamp.className = "note";
  stamp.dataset.liveUpdated = "";
  stamp.textContent = deal.updatedLabel;
  link.append(top, stage, stamp);
  const note = list.querySelector(":scope > p.note");
  list.insertBefore(link, note);
}

export function DealLivePulse() {
  useEffect(() => {
    let timer = 0;
    let stopped = false;
    async function tick() {
      try {
        const response = await fetch(withBasePath("/api/deals/live"), { cache: "no-store" });
        if (response.ok) {
          const body = await response.json() as { deals?: LiveDeal[] };
          for (const deal of body.deals ?? []) {
            if (!document.querySelector(`[data-deal-id="${CSS.escape(deal.id)}"]`)) appendCard(deal);
            paint(deal);
          }
        }
      } catch {
        // Keep the last paint. The next poll tries again.
      }
      if (!stopped) timer = window.setTimeout(tick, document.hidden ? 15000 : WAIT_MS);
    }
    timer = window.setTimeout(tick, WAIT_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}

"use client";

import { KASH_MARK } from "@/lib/worlds/economy";
import { WORLDS_RAIL, type WorldsRailId } from "@/lib/worlds/worlds-hud";

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2.5a6.2 6.2 0 0 0-6.2 6.2c0 4.6 6.2 12.8 6.2 12.8s6.2-8.2 6.2-12.8A6.2 6.2 0 0 0 12 2.5Zm0 8.4a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
    </svg>
  );
}

function IconBag() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M7 8V7a5 5 0 0 1 10 0v1h2.2a1 1 0 0 1 1 .9l1.2 12a1 1 0 0 1-1 .1 1 1 0 0 1-.9 1.1H4.5a1 1 0 0 1-1-1.1l1.2-12a1 1 0 0 1 1-.9H7Zm2 0h6V7a3 3 0 0 0-6 0v1Z" />
    </svg>
  );
}

function IconTasks() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M6 3.5h9.2A2.8 2.8 0 0 1 18 6.3V20.5H7.2A2.7 2.7 0 0 1 4.5 17.8V6A2.5 2.5 0 0 1 6 3.5Zm1.2 5.2 1.3 1.3 2.6-2.8 1.2 1.1-3.8 4.1-2.5-2.5 1.2-1.2Zm0 5.2h7.2v1.6H7.2v-1.6Zm0 3.2h5.4V19H7.2v-1.9Z" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M10.2 2.6h3.6l.4 2.2a7.2 7.2 0 0 1 1.7.9l2-1.1 1.8 3.1-1.7 1.4a7.4 7.4 0 0 1 0 1.8l1.7 1.4-1.8 3.1-2-1.1a7.2 7.2 0 0 1-1.7.9l-.4 2.2h-3.6l-.4-2.2a7.2 7.2 0 0 1-1.7-.9l-2 1.1-1.8-3.1 1.7-1.4a7.4 7.4 0 0 1 0-1.8L4.3 7.7l1.8-3.1 2 1.1a7.2 7.2 0 0 1 1.7-.9l.4-2.2ZM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" />
    </svg>
  );
}

function IconPack() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8 6.2V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.2h2.2A1.8 1.8 0 0 1 20 8v11.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 19.2V8a1.8 1.8 0 0 1 1.8-1.8H8Zm2-1.2v1.2h4V5h-4Zm-1.2 6.2h6.4v1.6H8.8v-1.6Z" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8 10V8a4 4 0 0 1 8 0v2h1.2A1.8 1.8 0 0 1 19 11.8v7.4a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 19.2v-7.4A1.8 1.8 0 0 1 6.8 10H8Zm2 0h4V8a2 2 0 0 0-4 0v2Z" />
    </svg>
  );
}

function RailIcon({ id }: { id: WorldsRailId }) {
  if (id === "places") return <IconPin />;
  if (id === "shop") return <IconBag />;
  if (id === "tasks") return <IconTasks />;
  if (id === "settings") return <IconGear />;
  return <IconPack />;
}

export function WorldsHud({
  walletText,
  bankText,
  onWallet,
  onBank,
  quest,
  onQuest,
  inventoryLocked,
  active,
  onOpen,
}: {
  walletText: string;
  bankText: string;
  onWallet: () => void;
  onBank: () => void;
  quest: string;
  onQuest: () => void;
  inventoryLocked: boolean;
  active: WorldsRailId | null;
  onOpen: (id: WorldsRailId) => void;
}) {
  return (
    <div className="worlds-hud" data-worlds-hud="">
      <div className="worlds-currencies" aria-label="Kash">
        <button type="button" className="worlds-money" onClick={onWallet}>
          <span className="worlds-money-icon is-wallet" aria-hidden="true">{KASH_MARK}</span>
          <span className="worlds-money-copy">
            <span className="worlds-money-label">Kash</span>
            <span className="worlds-money-value">{walletText}</span>
          </span>
        </button>
        <button type="button" className="worlds-money" onClick={onBank}>
          <span className="worlds-money-icon is-bank" aria-hidden="true">⌂</span>
          <span className="worlds-money-copy">
            <span className="worlds-money-label">Bank</span>
            <span className="worlds-money-value">{bankText}</span>
          </span>
        </button>
      </div>

      <button type="button" className="worlds-quest" onClick={onQuest}>
        <span className="worlds-quest-mark" aria-hidden="true">↑</span>
        <span className="worlds-quest-copy">
          <span className="worlds-quest-kicker">NEXT UP!</span>
          <span className="worlds-quest-text">{quest}</span>
        </span>
      </button>

      <div className="worlds-rail" aria-label="World menu">
        {WORLDS_RAIL.map((item) => {
          const locked = item.id === "inventory" && inventoryLocked;
          return (
            <button
              key={item.id}
              type="button"
              className={locked ? "is-locked" : active === item.id ? "is-active" : undefined}
              aria-label={locked ? `${item.label}, locked` : item.label}
              aria-pressed={active === item.id}
              aria-disabled={locked}
              onClick={() => {
                if (!locked) onOpen(item.id);
              }}
            >
              {locked ? <IconLock /> : <RailIcon id={item.id} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

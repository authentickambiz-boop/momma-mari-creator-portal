"use client";

import { useId, useState } from "react";
import { CREATOR_NICHES, MAX_NICHES, NICHE_OTHER_MAX } from "@/lib/creator-niche-shared";

export function NicheMultiSelect({
  name = "niches",
  selected,
  nicheOther = "",
  onChange,
}: {
  name?: string;
  selected: string[];
  nicheOther?: string;
  onChange?: (picked: string[]) => void;
}) {
  const listId = useId();
  const [picked, setPicked] = useState(selected);
  const [open, setOpen] = useState(false);
  const atMax = picked.length >= MAX_NICHES;

  function toggle(id: string) {
    setPicked((items) => {
      const has = items.includes(id);
      if (!has && items.length >= MAX_NICHES) return items;
      const next = has ? items.filter((item) => item !== id) : [...items, id];
      onChange?.(next);
      return next;
    });
  }

  return (
    <div className="tag-picker">
      <span id={`${listId}-label`}>Niches</span>
      <div className="tag-chips">
        {picked.map((id) => {
          const label = CREATOR_NICHES.find((niche) => niche.id === id)?.label ?? id;
          return (
            <span key={id} className="tag-chip">
              {label}
              <button type="button" aria-label={`Remove ${label}`} onClick={() => toggle(id)}>×</button>
              <input type="hidden" name={name} value={id} />
            </span>
          );
        })}
      </div>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        Choose niches
      </button>
      {open ? (
        <ul id={listId} role="listbox" aria-label="Niches" aria-multiselectable="true">
          {CREATOR_NICHES.map((niche) => {
            const on = picked.includes(niche.id);
            const disabled = !on && atMax;
            return (
              <li key={niche.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  disabled={disabled}
                  onClick={() => toggle(niche.id)}
                >
                  {niche.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {atMax ? <p className="note">Pick up to 5</p> : null}
      {picked.includes("other") ? (
        <label>
          Other
          <input name="nicheOther" maxLength={NICHE_OTHER_MAX} defaultValue={nicheOther} />
        </label>
      ) : null}
    </div>
  );
}

export function showStreamerFields(niches: string[], platforms: string[]) {
  const nicheHit = niches.some((niche) => niche === "gaming" || niche === "streaming");
  const platformHit = platforms.some((platform) => {
    const key = platform.trim().toLowerCase();
    return key === "kick" || key === "twitch" || key === "youtube live" || key === "youtube_live";
  });
  return nicheHit || platformHit;
}

export function StreamerFields({
  open,
  avgViewers = "",
  hoursPerWeek = "",
  streamCategories = "",
  analyticsProof = "",
}: {
  open: boolean;
  avgViewers?: string;
  hoursPerWeek?: string;
  streamCategories?: string;
  analyticsProof?: string;
}) {
  return (
    <fieldset hidden={!open}>
      <legend>Streaming</legend>
      <label>
        Average viewers
        <input name="avgViewers" inputMode="numeric" defaultValue={avgViewers} />
      </label>
      <label>
        Hours per week
        <input name="hoursPerWeek" inputMode="numeric" defaultValue={hoursPerWeek} />
      </label>
      <label>
        Stream categories
        <input name="streamCategories" defaultValue={streamCategories} />
      </label>
      <label>
        Analytics screenshot or link
        <input name="analyticsProof" defaultValue={analyticsProof.startsWith("upload:") ? "" : analyticsProof} placeholder="https://" />
      </label>
      <label>
        Upload a dashboard screenshot
        <input name="analyticsProofFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
      </label>
    </fieldset>
  );
}

export type PlatformDraft = { platform: string; handle: string; url: string; followers: string };

export function PlatformFields({
  options,
  labels,
  selected,
  rows,
  niches,
  avgViewers,
  hoursPerWeek,
  streamCategories,
  analyticsProof,
}: {
  options: readonly string[];
  labels?: Record<string, string>;
  selected: string[];
  rows: PlatformDraft[];
  niches: string[];
  avgViewers?: string;
  hoursPerWeek?: string;
  streamCategories?: string;
  analyticsProof?: string;
}) {
  const [platforms, setPlatforms] = useState(selected);
  const byPlatform = new Map(rows.map((row) => [row.platform, row]));
  const labelFor = (platform: string) => labels?.[platform] ?? platform;
  return (
    <>
      <div className="tag-picker">
        <span>Platforms</span>
        <div className="tag-chips">
          {platforms.map((platform) => (
            <span key={platform} className="tag-chip">
              {labelFor(platform)}
              <button type="button" aria-label={`Remove ${labelFor(platform)}`} onClick={() => setPlatforms((items) => items.filter((item) => item !== platform))}>×</button>
              <input type="hidden" name="platforms" value={platform} />
            </span>
          ))}
        </div>
        <label>
          Add a platform
          <select
            value=""
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              setPlatforms((items) => (items.includes(value) ? items : [...items, value]));
            }}
          >
            <option value="">Choose</option>
            {options.map((platform) => (
              <option key={platform} value={platform} disabled={platforms.includes(platform)}>{labelFor(platform)}</option>
            ))}
          </select>
        </label>
      </div>
      {platforms.map((platform) => {
        const row = byPlatform.get(platform);
        return (
          <fieldset key={platform}>
            <legend>{labelFor(platform)}</legend>
            <label>
              Handle
              <input name={`handle${platform}`} defaultValue={row?.handle ?? ""} placeholder="@name" />
            </label>
            <label>
              Profile URL
              <input name={`url${platform}`} defaultValue={row?.url ?? ""} placeholder="https://" />
            </label>
            <label>
              Followers
              <input name={`followers${platform}`} inputMode="numeric" defaultValue={row?.followers ?? ""} />
            </label>
          </fieldset>
        );
      })}
      <StreamerFields
        open={showStreamerFields(niches, platforms)}
        avgViewers={avgViewers}
        hoursPerWeek={hoursPerWeek}
        streamCategories={streamCategories}
        analyticsProof={analyticsProof}
      />
    </>
  );
}

const STREAM_PLATFORM_NAMES = new Set(["Kick", "Twitch", "YouTube Live"]);

export function ProfileNichePlatforms({
  niches,
  nicheOther,
  platforms,
  rows,
  avgViewers,
  hoursPerWeek,
  streamCategories,
  analyticsProof,
}: {
  niches: string[];
  nicheOther: string;
  platforms: readonly string[];
  rows: PlatformDraft[];
  avgViewers: string;
  hoursPerWeek: string;
  streamCategories: string;
  analyticsProof: string;
}) {
  const [picked, setPicked] = useState<string[]>(niches);
  const [active, setActive] = useState<string[]>(rows.filter((row) => row.handle.trim()).map((row) => row.platform));
  const labels = Object.fromEntries(platforms.map((platform) => [platform, platform === "X" ? "X (Twitter)" : platform]));

  function notePlatform(platform: string, handle: string) {
    if (!STREAM_PLATFORM_NAMES.has(platform)) return;
    setActive((items) => {
      const filled = handle.trim().length > 0;
      if (filled) return items.includes(platform) ? items : [...items, platform];
      return items.filter((item) => item !== platform);
    });
  }

  return (
    <>
      <NicheMultiSelect selected={picked} nicheOther={nicheOther} onChange={setPicked} />
      {platforms.map((platform) => {
        const row = rows.find((item) => item.platform === platform);
        return (
          <fieldset key={platform} className="member-fields">
            <legend>{labels[platform]}</legend>
            <label>
              Handle
              <input
                name={`platform-${platform}`}
                defaultValue={row?.handle ?? ""}
                placeholder="@handle"
                onChange={(event) => notePlatform(platform, event.target.value)}
              />
            </label>
            <label>
              Profile URL
              <input name={`platform-url-${platform}`} defaultValue={row?.url ?? ""} placeholder="https://" />
            </label>
            <label>
              Followers
              <input name={`platform-followers-${platform}`} inputMode="numeric" defaultValue={row?.followers ?? ""} />
            </label>
          </fieldset>
        );
      })}
      <StreamerFields
        open={showStreamerFields(picked, active)}
        avgViewers={avgViewers}
        hoursPerWeek={hoursPerWeek}
        streamCategories={streamCategories}
        analyticsProof={analyticsProof}
      />
    </>
  );
}

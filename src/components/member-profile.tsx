import Link from "next/link";
import { RankBadge } from "@/components/rank-badge";
import { pinHost } from "@/lib/member-profile";
import type { PublicProfile } from "@/lib/profiles";

function Cover({ card, tall }: { card: PublicProfile; tall?: boolean }) {
  return (
    <div className={tall ? "member-cover member-cover-tall" : "member-cover"}>
      {card.coverImage ? <img src={card.coverImage} alt="" /> : null}
    </div>
  );
}

function Face({ card }: { card: PublicProfile }) {
  return (
    <div className="member-face">
      {card.avatarImage ? <img src={card.avatarImage} alt={`${card.displayName ?? "Creator"} profile photo`} /> : <span>{card.initials ?? ""}</span>}
    </div>
  );
}

function Pins({ card }: { card: PublicProfile }) {
  if (!card.pins?.length) return null;
  return (
    <div className="member-pins">
      {card.pins.map((pin) => (
        <a key={pin.url} className="member-pin" href={pin.url} target="_blank" rel="noopener noreferrer">
          {pin.thumb ? <img src={pin.thumb} alt="" /> : <span className="member-pin-host">{pinHost(pin.url)}</span>}
          <span>{pin.title}</span>
        </a>
      ))}
    </div>
  );
}

export function MemberCard({ card }: { card: PublicProfile }) {
  return (
    <Link className="card member-card" href={`/directory/${card.creatorId}`}>
      <Cover card={card} />
      <Face card={card} />
      <div className="member-body">
        <b>{card.displayName}</b>
        <RankBadge score={card.rankScore} />
        {card.profileHidden ? <span className="chip c-gray">Hidden</span> : null}
        {card.safetyKinds?.length ? <span className="chip c-sun">Held for review</span> : null}
        {card.photoHeld ? <span className="chip c-sun">Photos held</span> : null}
        {card.bio ? <p>{card.bio}</p> : null}
        {card.niches?.length ? <p className="note">{card.niches.join(" · ")}</p> : null}
      </div>
    </Link>
  );
}

export function MemberProfile({ card }: { card: PublicProfile }) {
  return (
    <article className="card member-profile">
      <Cover card={card} tall />
      <Face card={card} />
      <div className="member-body">
        <b>{card.displayName}</b>
        <RankBadge score={card.rankScore} />
        {card.profileHidden ? <span className="chip c-gray">Hidden</span> : null}
        {card.safetyKinds?.length ? <span className="chip c-sun">Held for review</span> : null}
        {card.photoHeld ? <span className="chip c-sun">Photos held</span> : null}
        {card.joined ? <p className="note">Joined {card.joined}</p> : null}
        {card.bio ? <p>{card.bio}</p> : null}
        {card.niches?.length ? <p>{card.niches.join(" · ")}</p> : null}
        {card.platforms?.length ? (
          <p>{card.platforms.map((item) => `${item.platform} @${item.handle}`).join(" · ")}</p>
        ) : null}
        {card.handles ? <p>{card.handles}</p> : null}
        <Pins card={card} />
        {card.snack ? <p>Favorite snack: {card.snack}</p> : null}
        {card.loving ? <p>Currently loving: {card.loving}</p> : null}
        {card.weekend ? <p>Weekend plan: {card.weekend}</p> : null}
        {card.audience ? <p>{card.audience}</p> : null}
        {card.formats?.length ? <p>{card.formats.join(", ")}</p> : null}
        {card.askMe ? <p>Ask me about {card.askMe}</p> : null}
        {card.collabs ? <p>Open to collabs</p> : null}
        {card.state ? <p>{card.state}</p> : null}
        {card.brands?.length ? <p>Brands: {card.brands.join(", ")}</p> : null}
        {card.family ? <p>{card.family.name} · {card.family.age}</p> : null}
        <p className="note">Messages aren&apos;t open yet.</p>
      </div>
    </article>
  );
}

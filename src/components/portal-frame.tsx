import Link from "next/link";
import { logoutAction } from "@/app/actions";
import type { CreatorProfile, Viewer } from "@/lib/types";

const TABS = [
  { id: "deals", href: "/", label: "Brand deals" },
  { id: "earnings", href: "/earnings", label: "Earnings & payouts" },
  { id: "analytics", href: "/analytics", label: "Analytics" },
  { id: "connect", href: "/connect", label: "Connect accounts" },
] as const;

export function PortalFrame({
  viewer,
  tab,
  creators,
  viewedId,
  hello,
  children,
}: {
  viewer: Viewer;
  tab: (typeof TABS)[number]["id"];
  creators: CreatorProfile[];
  viewedId: string | "all";
  hello: React.ReactNode;
  children: React.ReactNode;
}) {
  const query = (id: string) => (viewer.role === "admin" ? `?creator=${id}` : "");
  return (
    <>
      <div className="demo-bar">
        Pilot. Mariclare&apos;s deals are seed data from her inbox as of Oct 17, 2026. TBD means the emails don&apos;t say yet.
      </div>
      <header className="top">
        <Link href={viewer.role === "admin" ? `/${query(viewedId === "all" ? "mariclare" : viewedId)}` : "/"} className="brand">
          <div className="logo">M</div>
          <div>
            <strong>Momma Mari</strong>
            <small>Creator Portal</small>
          </div>
        </Link>
        <div className="me">
          <span className="who">Signed in as {viewer.name}</span>
          <form action={logoutAction}>
            <button className="signout" type="submit">Sign out</button>
          </form>
          <div className="avatar">{viewer.initials || viewer.name.slice(0, 1)}</div>
        </div>
      </header>
      <div className="wrap">
        {hello}
        {viewer.role === "admin" ? (
          <div className="switcher">
            {creators.map((creator) => (
              <Link key={creator.id} href={`${tab === "deals" ? "/" : `/${tab}`}${query(creator.id)}`} className={viewedId === creator.id ? "on" : ""}>
                {creator.name}
              </Link>
            ))}
            <Link href={`${tab === "deals" ? "/" : `/${tab}`}?creator=all`} className={viewedId === "all" ? "on" : ""}>
              All creators
            </Link>
          </div>
        ) : null}
        <nav className="tabs">
          {TABS.map((item) => (
            <Link key={item.id} href={`${item.href}${query(viewedId)}`} className={item.id === tab ? "on" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
        {viewer.role === "admin" && viewedId !== "all" ? (
          <div className="admin-banner">
            You&apos;re signed in as Kamron. This is {creators.find((creator) => creator.id === viewedId)?.name}&apos;s portal.
            She can&apos;t see hidden deals or your notes.
          </div>
        ) : null}
        {children}
      </div>
    </>
  );
}

export function MaybeTbd({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="tbd">TBD</span>;
  if (/^TBD\b/.test(value)) return <span className="tbd">{value}</span>;
  return <>{value}</>;
}

export function Chips({ chips }: { chips: { text: string; tone: string }[] }) {
  return (
    <>
      {chips.map((chip) => (
        <span key={chip.text} className={`chip ${chip.tone}`}>{chip.text}</span>
      ))}
    </>
  );
}
